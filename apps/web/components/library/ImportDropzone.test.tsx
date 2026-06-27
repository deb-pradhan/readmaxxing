/**
 * ImportDropzone component tests — paste handler parses text and POSTs.
 *
 * Audit C1 (Phase C): POST `/api/import` returns 201 with `{ documentId }`
 * (and a deprecated `id` alias for one release). The dropzone must read
 * `documentId` and call `router.push(`/reader/${documentId}`)`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import * as React from "react";
import { ImportDropzone } from "./ImportDropzone";

// Mock the Next router so we can capture push() calls (audit C1 verification).
const routerPushMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerPrefetchMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
    prefetch: routerPrefetchMock,
  }),
}));

function makeFile(name: string, sizeBytes: number, type: string): File {
  const placeholder = new File(["x"], name, { type });
  Object.defineProperty(placeholder, "size", { value: sizeBytes, configurable: true });
  placeholder.arrayBuffer = async () => new TextEncoder().encode("x").buffer;
  return placeholder;
}

describe("ImportDropzone", () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    routerReplaceMock.mockReset();
    routerPrefetchMock.mockReset();
  });

  it("renders the empty drop zone with a Choose file button", () => {
    const { getByText } = render(<ImportDropzone />);
    expect(getByText(/drop a file or paste a screenshot/i)).toBeInTheDocument();
    expect(getByText(/choose file/i)).toBeInTheDocument();
  });

  it("uses documentId from the response and routes to /reader/[id] (audit C1)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          documentId: "doc-1",
          id: "doc-1", // deprecated alias — must remain accepted
          title: "Pasted text",
          status: "parsed",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<ImportDropzone />);
    const region = container.querySelector<HTMLElement>("[role='region']");
    expect(region).not.toBeNull();
    const clipboardData = {
      getData: (mime: string) => (mime === "text/plain" ? "Hello world." : ""),
    };
    const pasteEvent = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: typeof clipboardData;
    };
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: clipboardData,
    });
    fireEvent(region!, pasteEvent);
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalled();
    expect(routerPushMock).toHaveBeenCalledWith("/reader/doc-1");
  });

  it("falls back to legacy `id` field when `documentId` is absent", async () => {
    // Some older deploys / extension consumers may still only emit `id`. The
    // client must tolerate that for one release (audit C1).
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: "legacy-id", title: "Old", status: "parsed" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<ImportDropzone />);
    const region = container.querySelector<HTMLElement>("[role='region']");
    expect(region).not.toBeNull();
    const clipboardData = {
      getData: (mime: string) => (mime === "text/plain" ? "Hello world." : ""),
    };
    const pasteEvent = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: typeof clipboardData;
    };
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: clipboardData,
    });
    fireEvent(region!, pasteEvent);
    await new Promise((r) => setTimeout(r, 30));
    expect(routerPushMock).toHaveBeenCalledWith("/reader/legacy-id");
  });

  it("accepts image files and routes them to /api/import/ocr", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          documentId: "doc-ocr",
          title: "Scan",
          pageCount: 1,
          medianConfidence: 0.92,
          lowConfidence: false,
          status: "parsed",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container } = render(<ImportDropzone />);
    const input = container.querySelector<HTMLInputElement>("input[type=file]");
    expect(input).not.toBeNull();
    const file = makeFile("scan.png", 32_000, "image/png");
    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
    });
    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, ...unknown[]]>;
    const ocrCall = calls.find(
      (call) => typeof call[0] === "string" && call[0] === "/api/import/ocr",
    );
    expect(ocrCall).toBeDefined();
  });

  it("shows the scanning message while OCR runs", async () => {
    // Use a deferred promise so the fetch doesn't resolve until we check.
    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container, findAllByText } = render(<ImportDropzone />);
    const input = container.querySelector<HTMLInputElement>("input[type=file]");
    const file = makeFile("scan.jpg", 32_000, "image/jpeg");
    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
    });
    // "Scanning…" appears on the button and in the progress row — assert ≥1.
    expect((await findAllByText(/scanning/i)).length).toBeGreaterThan(0);

    // Resolve the fetch to unblock the component.
    if (resolveFetch) {
      (resolveFetch as (v: Response) => void)(
        new Response(
          JSON.stringify({
            documentId: "doc-ocr",
            title: "Scan",
            pageCount: 1,
            medianConfidence: 0.9,
            lowConfidence: false,
            status: "parsed",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
  });
});