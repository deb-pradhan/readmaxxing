/**
 * Library page — Phase D P1 (D.3) verification.
 *
 * Covers:
 * - ContinueShelf renders ABOVE ImportDropzone (audit + D32/D33).
 * - The "Pasted" filter chip is non-empty when seeded with `sourceType="paste"`
 *   docs (the prior lowercase comparison silently dropped them).
 * - `applyLibraryFilter` is the single source of truth for chip → source
 *   matching (regression guard for the D.3 fix).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }) as unknown as URLSearchParams,
}));

vi.mock("next/dynamic", () => ({
  default:
    () =>
    (_props: Record<string, unknown>): React.JSX.Element => {
      return <div data-testid="mock-dynamic" />;
    },
}));

// Stubs so the library page can render without pulling BFF + IndexedDB + UI chrome.
vi.mock("@/components/library/DocCard", () => ({
  DocCard: ({
    title,
    sourceType,
  }: {
    title: string;
    sourceType: string;
  }): React.JSX.Element => (
    <div data-testid="doc-card" data-source-type={sourceType}>
      {title}
    </div>
  ),
}));

vi.mock("@/components/library/ImportDropzone", () => ({
  ImportDropzone: (): React.JSX.Element => (
    <div data-testid="import-dropzone">Import</div>
  ),
}));

vi.mock("@/components/library/ContinueShelf", () => ({
  ContinueShelf: (): React.JSX.Element => (
    <div data-testid="continue-shelf">Continue</div>
  ),
}));

vi.mock("@/components/shared/ThemeSwitcher", () => ({
  ThemeSwitcher: (): React.JSX.Element => <div data-testid="theme-switcher" />,
}));

vi.mock("@/components/shared/CommandPalette", () => ({
  CommandPalette: (): React.JSX.Element => <div />,
}));

vi.mock("@/components/shared/KeyboardShortcuts", () => ({
  KeyboardShortcuts: (): React.JSX.Element => <div />,
}));

function makeDocsResponse(): Response {
  const docs = [
    {
      id: "d1",
      title: "A pasted note",
      source: "pasted",
      sourceType: "paste",
      wordCount: 100,
      estimatedReadTimeSeconds: 30,
      addedAt: new Date().toISOString(),
      segmentTreeId: "t1",
    },
    {
      id: "d2",
      title: "Another pasted note",
      source: "pasted",
      sourceType: "paste",
      wordCount: 200,
      estimatedReadTimeSeconds: 60,
      addedAt: new Date().toISOString(),
      segmentTreeId: "t2",
    },
    {
      id: "d3",
      title: "A PDF",
      source: "file.pdf",
      sourceType: "pdf",
      wordCount: 400,
      estimatedReadTimeSeconds: 120,
      addedAt: new Date().toISOString(),
      segmentTreeId: "t3",
    },
  ];
  return new Response(JSON.stringify({ documents: docs }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LibraryPage (Phase D P1 — D.3)", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });

  it("renders ContinueShelf ABOVE ImportDropzone", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) {
        return makeDocsResponse();
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    const { container } = render(<LibraryPage />);

    // ContinueShelf is dynamic with ssr: false — the SECTION containing
    // the shelf still mounts even if the inner component is a no-op
    // placeholder. We verify ordering via the section aria-label.
    const continueSection = container.querySelector('section[aria-label="Continue listening"]');
    const importSection = container.querySelector('section[aria-label="Add a document"]');
    expect(continueSection).not.toBeNull();
    expect(importSection).not.toBeNull();

    const cont = container as HTMLElement;
    const shelfIdx = Array.from(cont.querySelectorAll("section")).indexOf(
      continueSection as HTMLElement,
    );
    const dropzoneIdx = Array.from(cont.querySelectorAll("section")).indexOf(
      importSection as HTMLElement,
    );
    expect(shelfIdx).toBeLessThan(dropzoneIdx);
  });

  it('"Pasted" filter chip matches `sourceType="paste"` docs (no longer empty)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) {
        return makeDocsResponse();
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    render(<LibraryPage />);

    // Wait for docs to load.
    await waitFor(() => {
      expect(screen.getAllByTestId("doc-card").length).toBe(3);
    });

    // Click the Pasted chip.
    const pastedChip = screen.getByRole("button", { name: "Pasted" });
    expect(pastedChip).toBeInTheDocument();
    fireEvent.click(pastedChip);

    await waitFor(() => {
      const cards = screen.queryAllByTestId("doc-card");
      // Two pasted docs remain visible; PDF is filtered out.
      expect(cards.length).toBe(2);
    });
    const remaining = screen.getAllByTestId("doc-card");
    for (const c of remaining) {
      expect((c as HTMLElement).dataset.sourceType).toBe("paste");
    }
  });
});

describe("applyLibraryFilter (regression guard)", () => {
  it("returns all docs when match is null (All filter)", async () => {
    const { applyLibraryFilter, LIBRARY_FILTERS } = await import(
      "@/lib/documents/source"
    );
    const docs = [
      { id: "1", sourceType: "paste" as const },
      { id: "2", sourceType: "pdf" as const },
    ];
    const all = LIBRARY_FILTERS.find((f) => f.label === "All");
    expect(all).toBeDefined();
    expect(applyLibraryFilter(docs, all!)).toEqual(docs);
  });

  it("maps 'Pasted' label back to sourceType 'paste'", async () => {
    const {
      applyLibraryFilter,
      LIBRARY_FILTERS,
      DOCUMENT_SOURCE_LABELS,
    } = await import("@/lib/documents/source");
    expect(DOCUMENT_SOURCE_LABELS.paste).toBe("Pasted");
    const pasted = LIBRARY_FILTERS.find((f) => f.label === "Pasted");
    expect(pasted?.match).toBe("paste");
    const docs = [
      { id: "1", sourceType: "paste" as const },
      { id: "2", sourceType: "pdf" as const },
    ];
    const out = applyLibraryFilter(docs, pasted!);
    expect(out.map((d) => d.id)).toEqual(["1"]);
  });
});