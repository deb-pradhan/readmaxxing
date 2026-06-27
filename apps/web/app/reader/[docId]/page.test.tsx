/**
 * /reader/[docId] — audit C2 (Phase C) playbackRate re-application.
 *
 * The reader page mounts an `<audio>` element and must re-apply
 * `audio.playbackRate` every time the `speed` state changes. Before Phase C,
 * `playbackRate` was set only once on `loadedmetadata`, so subsequent speed
 * changes were silently dropped until the next reload. This test asserts the
 * fix without booting the full reader chrome.
 *
 * We render the real page in jsdom, mock the heavy deps (TTS, fetch, dynamic
 * modals), and observe the `<audio>` element's `playbackRate` directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

// ---- mocks (must be hoisted before the page import) ----------------------------

const mockTree = {
  segmentTreeId: "tree1",
  text: "Hello world. This is a test document for the reader page.",
  wordCount: 9,
  estimatedReadTimeSeconds: 3,
  paragraphs: [
    {
      index: 0,
      start: 0,
      end: 50,
      text: "Hello world.",
      headingLevel: 0,
      sentences: [
        {
          index: 0,
          start: 0,
          end: 12,
          text: "Hello world.",
          words: [
            { text: "Hello", start: 0, end: 5 },
            { text: "world.", start: 6, end: 12 },
          ],
        },
      ],
    },
  ],
};

// Mock the Next router/params so useParams returns our test docId.
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ docId: "doc-test" }),
  useSearchParams: () => ({ get: () => null }) as unknown as URLSearchParams,
}));

// Mock next/dynamic's KeyboardShortcuts to a no-op component.
vi.mock("next/dynamic", () => ({
  default:
    () =>
    (_props: Record<string, unknown>): React.JSX.Element => {
      return <div data-testid="mock-keyboard-shortcuts" />;
    },
}));

// Stub the TTS client so the page receives a fake audio URL + empty marks.
vi.mock("@/lib/tts/client", () => ({
  clientSynthesize: vi.fn(async () => ({
    audioUrl: "blob:mock-audio-url",
    marks: [
      { type: "sentence", start: 0, end: 12, timeSeconds: 0, text: "Hello world." },
    ],
    fromCache: false,
  })),
}));

// Stub the AI subcomponents so the page doesn't pull OpenRouter/network.
vi.mock("@/components/ai/SummaryPanel", () => ({
  SummaryPanel: () => <div data-testid="mock-summary" />,
}));
vi.mock("@/components/ai/QuizCard", () => ({
  QuizCard: () => <div data-testid="mock-quiz" />,
}));
vi.mock("@/components/ai/AskChat", () => ({
  AskChat: () => <div data-testid="mock-askchat" />,
}));

// Stub the reader chrome (PlayerBar) to keep this test focused on the audio effect.
vi.mock("@/components/player/PlayerBar", () => ({
  PlayerBar: (
    _props: Record<string, unknown>,
  ): React.JSX.Element => {
    return <div data-testid="mock-playerbar" />;
  },
}));

// Stub the selection/reading-ruler subcomponents — they're orthogonal to C2.
vi.mock("@/components/reader/SelectionMenu", () => ({
  SelectionMenu: () => <div />,
}));
vi.mock("@/components/reader/ReadingRuler", () => ({
  ReadingRuler: () => <div />,
}));
vi.mock("@/components/reader/ProgressRail", () => ({
  ProgressRail: () => <div />,
}));

// Stub the shared keyboard-shortcuts modal (dynamic import).
vi.mock("@/components/shared/KeyboardShortcuts", () => ({
  KeyboardShortcuts: () => <div />,
}));

// ---- helpers ------------------------------------------------------------------

function makePrefsResponse(defaultSpeed: number | null): Response {
  return new Response(
    JSON.stringify({ defaultSpeed, defaultVoiceId: "v1" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeDocResponse(): Response {
  return new Response(
    JSON.stringify({
      id: "doc-test",
      title: "Test doc",
      segmentTree: mockTree,
      segmentTreeId: "tree1",
      fillerSegments: [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makePositionsResponse(): Response {
  return new Response(JSON.stringify({ positions: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- tests --------------------------------------------------------------------

describe("ReaderPage audit C2 — playbackRate re-applies on speed change", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });

  it("re-applies audio.playbackRate when speed state changes", async () => {
    // First GET → /api/user/preferences returns defaultSpeed=null (first-time user).
    // First GET → /api/documents/[id] returns the doc.
    // First GET → /api/positions returns empty.
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/user/preferences")) {
        return makePrefsResponse(null);
      }
      if (url.includes("/api/documents/")) {
        return makeDocResponse();
      }
      if (url.includes("/api/positions")) {
        return makePositionsResponse();
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const ReaderPage = (await import("./page")).default;
    render(<ReaderPage />);

    // Wait for the tree to load + audio element to mount. The element renders
    // unconditionally after `tree` is non-null (which the mock fetch resolves
    // synchronously in jsdom).
    await waitFor(
      () => {
        const el = document.querySelector("audio");
        if (!el) throw new Error("audio not mounted yet");
        return el;
      },
      { timeout: 5000 },
    );
    const el = document.querySelector("audio");
    expect(el).not.toBeNull();
    const audioEl = el as HTMLAudioElement;
    // Default speed is 1.0 → onLoadedMetadata sets playbackRate to 1.0.
    await act(async () => {
      audioEl.dispatchEvent(new Event("loadedmetadata"));
    });
    await waitFor(() => {
      expect(audioEl.playbackRate).toBe(1);
    });

    // Now bump the speed via the player store. The PlayerBar mock doesn't
    // expose setSpeed, so we go through the store directly.
    const { usePlayerStore } = await import("@/stores/player-store");
    act(() => {
      usePlayerStore.getState().setSpeed(1.5);
    });
    await waitFor(() => {
      expect(audioEl.playbackRate).toBe(1.5);
    });

    // And back down.
    act(() => {
      usePlayerStore.getState().setSpeed(0.75);
    });
    await waitFor(() => {
      expect(audioEl.playbackRate).toBe(0.75);
    });
  });

  it("hydrates speed from persisted preference on mount (defaultSpeed=1.25)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/user/preferences")) {
        return makePrefsResponse(1.25);
      }
      if (url.includes("/api/documents/")) {
        return makeDocResponse();
      }
      if (url.includes("/api/positions")) {
        return makePositionsResponse();
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const ReaderPage = (await import("./page")).default;
    render(<ReaderPage />);

    await waitFor(
      () => {
        const el = document.querySelector("audio");
        if (!el) throw new Error("audio not mounted yet");
        return el;
      },
      { timeout: 5000 },
    );
    const el = document.querySelector("audio");
    expect(el).not.toBeNull();
    const audioEl = el as HTMLAudioElement;
    // On mountedmetadata the rate must reflect the persisted preference (1.25),
    // not the default 1.0.
    await act(async () => {
      audioEl.dispatchEvent(new Event("loadedmetadata"));
    });
    await waitFor(() => {
      expect(audioEl.playbackRate).toBe(1.25);
    });
  });

  // Phase D P1 (D.11): reader toolbar buttons are ≥44px touch targets.
  it("renders the reader toolbar toggle buttons at ≥44px (h-11)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/user/preferences")) {
        return makePrefsResponse(null);
      }
      if (url.includes("/api/documents/")) {
        return makeDocResponse();
      }
      if (url.includes("/api/positions")) {
        return makePositionsResponse();
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const ReaderPage = (await import("./page")).default;
    render(<ReaderPage />);

    // Wait for the page to render the toolbar (after tree loads).
    await waitFor(
      () => {
        const btn = screen.queryByRole("button", { name: /Focus mode/ });
        if (!btn) throw new Error("Focus mode button not mounted yet");
        return btn;
      },
      { timeout: 5000 },
    );
    // The four toolbar toggles — focus / bionic / guide / help — all carry
    // h-11 w-11 (44px) per Phase D P1 (D.11).
    const toggleLabels = [
      /Focus mode/,
      /Bionic reading/,
      /Reading guide/,
      /Keyboard shortcuts/,
    ];
    for (const re of toggleLabels) {
      const btn = screen.getByRole("button", { name: re });
      expect(btn.className).toContain("h-11");
      expect(btn.className).toContain("w-11");
    }
  });
});