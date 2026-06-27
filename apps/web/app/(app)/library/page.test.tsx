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

  it("the active filter chip uses the peach row (Phase F F.6)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) return makeDocsResponse();
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const LibraryPage = (await import("./page")).default;
    render(<LibraryPage />);
    // The default filter is "All" (the first one in LIBRARY_FILTERS).
    const allChip = document.querySelector(
      '[data-filter-label="All"]',
    ) as HTMLElement;
    expect(allChip.className).toContain("bg-coral-100");
    expect(allChip.className).toContain("text-coral-700");
    // Click PDF — it should now take the peach row.
    const pdfChip = screen.getByRole("button", { name: /^PDF/i });
    fireEvent.click(pdfChip);
    const activePdf = document.querySelector('[data-filter-label="PDF"]') as HTMLElement;
    expect(activePdf.className).toContain("bg-coral-100");
    expect(activePdf.className).toContain("text-coral-700");
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

describe("LibraryPage (Phase F — F.3 CountPill on filter chips)", () => {
  function makeDocsResponseForCounts(): Response {
    // 3 paste, 2 pdf, 1 url.
    const docs = [
      { id: "p1", title: "p1", source: "x", sourceType: "paste", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
      { id: "p2", title: "p2", source: "x", sourceType: "paste", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
      { id: "p3", title: "p3", source: "x", sourceType: "paste", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
      { id: "f1", title: "f1", source: "x", sourceType: "pdf", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
      { id: "f2", title: "f2", source: "x", sourceType: "pdf", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
      { id: "u1", title: "u1", source: "x", sourceType: "url", wordCount: 1, estimatedReadTimeSeconds: 1, addedAt: "", segmentTreeId: "t" },
    ];
    return new Response(JSON.stringify({ documents: docs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("renders a CountPill with the per-filter doc count on every filter chip", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) return makeDocsResponseForCounts();
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify({ positions: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("doc-card").length).toBe(6);
    });

    // Each filter chip carries the right count via `data-filter-count`.
    const allChip = document.querySelector('[data-filter-label="All"]') as HTMLElement | null;
    const pastedChip = document.querySelector('[data-filter-label="Pasted"]') as HTMLElement | null;
    const pdfChip = document.querySelector('[data-filter-label="PDF"]') as HTMLElement | null;
    const urlChip = document.querySelector('[data-filter-label="URL"]') as HTMLElement | null;
    expect(allChip?.dataset.filterCount).toBe("6");
    expect(pastedChip?.dataset.filterCount).toBe("3");
    expect(pdfChip?.dataset.filterCount).toBe("2");
    expect(urlChip?.dataset.filterCount).toBe("1");

    // CountPill renders mono + tabular numerals (DESIGN-SYSTEM §25.2).
    const allChipNumeral = allChip?.querySelector(".font-mono.tabular-nums") as HTMLElement | null;
    expect(allChipNumeral?.textContent).toBe("6");
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

describe("LibraryPage (Phase E — E.8 recap card + E.10 sample lock)", () => {
  function makeDocs(): Response {
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
    ];
    return new Response(JSON.stringify({ documents: docs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("does NOT mount the recap card when /api/ai/recap returns no recap", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) return makeDocs();
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify({ positions: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    const { container } = render(<LibraryPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId("doc-card").length).toBe(1);
    });
    // The recap card uses the "Pick up where you left off" eyebrow.
    expect(
      container.querySelector('section[aria-label="Pick up where you left off"]'),
    ).toBeNull();
  });

  it("mounts the recap card with title + recap text + Open CTA when recap is present", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) return makeDocs();
      if (url.includes("/api/positions")) {
        return new Response(
          JSON.stringify({
            positions: [
              {
                position: {
                  documentId: "d1",
                  lastPlayedAt: new Date().toISOString(),
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/ai/recap")) {
        return new Response(
          JSON.stringify({
            recap: "You were mid-paragraph about how the importer trusts paste.",
            generatedAt: new Date().toISOString(),
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    const { container } = render(<LibraryPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId("doc-card").length).toBe(1);
    });
    // Wait for the recap fetch chain to settle.
    await waitFor(() => {
      expect(
        container.querySelector('section[aria-label="Pick up where you left off"]'),
      ).not.toBeNull();
    });
    // Scope the assertion to the recap section so the DocCard doesn't collide.
    const recapSection = container.querySelector(
      'section[aria-label="Pick up where you left off"]',
    ) as HTMLElement;
    expect(recapSection.textContent).toMatch(/A pasted note/i);
    expect(recapSection.textContent).toMatch(/importer trusts paste/i);
    expect(
      recapSection.querySelector('a[href*="/reader/"]')?.getAttribute("href"),
    ).toBe("/reader/d1");
  });

  it("'Try a sample' fires /api/import exactly once even on rapid double-click (Phase E E.10)", async () => {
    let importCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) return makeDocs();
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify({ positions: [] }), { status: 200 });
      }
      if (url.includes("/api/import") && init?.method === "POST") {
        importCalls += 1;
        // Block resolution until we observe subsequent clicks.
        return new Promise<Response>((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ documentId: "doc-x" }), { status: 201 }),
              ),
            10,
          );
        });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const LibraryPage = (await import("./page")).default;
    render(<LibraryPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId("doc-card").length).toBe(1);
    });

    const trigger = screen.getByRole("button", { name: /try a sample/i });
    // Rapid double-click — should be coalesced to a single import.
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    // Allow the microtask + setTimeout to settle.
    await waitFor(() => {
      expect(importCalls).toBe(1);
    });
  });
});