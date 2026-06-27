/**
 * ImportDropzone component tests — paste handler parses text and POSTs.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import * as React from "react";
import { ImportDropzone } from "./ImportDropzone";

// Mock the Next router since the component uses router.push on import.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

function makeFile(name: string, sizeBytes: number, type: string): File {
  const placeholder = new File(["x"], name, { type });
  Object.defineProperty(placeholder, "size", { value: sizeBytes, configurable: true });
  placeholder.arrayBuffer = async () => new TextEncoder().encode("x").buffer;
  return placeholder;
}

describe("ImportDropzone", () => {
  it("renders the empty drop zone with a Choose file button", () => {
    const { getByText } = render(<ImportDropzone />);
    expect(getByText(/drop a file or paste a screenshot/i)).toBeInTheDocument();
    expect(getByText(/choose file/i)).toBeInTheDocument();
  });

  it("POSTs pasted text to /api/import", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "doc-1", title: "Pasted text", status: "parsed" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
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
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0] as
      | [unknown, RequestInit?]
      | undefined;
    const url = firstCall?.[0];
    expect(url).toBe("/api/import");
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