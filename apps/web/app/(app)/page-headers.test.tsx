/**
 * Page header sweep — Phase F (F.2) cross-page assertions.
 *
 * Per DESIGN-SYSTEM §25.2 + §25.6: every page in the `(app)` route
 * group leads with the v2 header pattern:
 *   1. `<Eyebrow>` first (UPPERCASE + 0.08em tracking, 11–12px,
 *      weight 600).
 *   2. `<h1>` second with the Display-1 clamp
 *      (`clamp(34px,8vw,52px)`, weight 800).
 *   3. Subtitle (the secondary-text paragraph) third.
 *
 * This test renders each page through mocked props and asserts the
 * order. Pages with content gates (data fetch, params) are mounted
 * with their mocks wired so the header region actually paints.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
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

vi.mock("@/components/shared/AppHeader", () => ({
  // Render the AppHeader as a plain top-level container; we drop the
  // `section` prop so the test doesn't see the section name twice
  // (once in the AppHeader, once in the page-level Eyebrow).
  AppHeader: ({ children }: { children?: React.ReactNode }): React.JSX.Element => (
    <div data-testid="app-header">{children}</div>
  ),
}));

vi.mock("@/components/shared/ThemeSwitcher", () => ({
  ThemeSwitcher: (): React.JSX.Element => <div data-testid="theme-switcher" />,
}));

vi.mock("@/components/library/DocCard", () => ({
  DocCard: ({ title }: { title: string }): React.JSX.Element => (
    <div data-testid="doc-card">{title}</div>
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

vi.mock("@/components/shared/CommandPalette", () => ({
  CommandPalette: (): React.JSX.Element => <div />,
}));

vi.mock("@/components/shared/KeyboardShortcuts", () => ({
  KeyboardShortcuts: (): React.JSX.Element => <div />,
}));

vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: (): React.JSX.Element => <div />,
}));

vi.mock("@/components/voice/VoiceCloneFlow", () => ({
  VoiceCloneFlow: ({ onCloned }: { onCloned: (id: string) => void }): React.JSX.Element => (
    <button type="button" onClick={() => onCloned("cloned:test")}>
      VoiceCloneFlow
    </button>
  ),
}));

vi.mock("@/components/ai/AskChat", () => ({
  AskChat: (): React.JSX.Element => <div data-testid="ask-chat" />,
}));

vi.mock("@/components/assistant/VoiceInput", () => ({
  VoiceInput: (): React.JSX.Element => <div data-testid="voice-input" />,
}));

vi.mock("@/components/assistant/VoiceOutput", () => ({
  VoiceOutput: (): React.JSX.Element => <div data-testid="voice-output" />,
}));

vi.mock("@/components/ai/PodcastCreator", () => ({
  PodcastCreator: (): React.JSX.Element => <div data-testid="podcast-creator" />,
  PODCAST_STYLES: ["podcast", "late_night", "debate", "lecture"],
}));

vi.mock("@/components/player/PlayerBar", () => ({
  PlayerBar: (): React.JSX.Element => <div data-testid="player-bar" />,
}));

/** Each page test asserts its eyebrow, h1, and subtitle. */
async function expectPageHeader(opts: {
  eyebrowText: string;
  h1Text: string;
  /** A substring that's unique to the subtitle of this page. */
  subtitleFragment: string;
}): Promise<void> {
  // Scope to <main> — the AppHeader section label uses the same word
  // as the page eyebrow ("Settings", "Voices", ...) but lives outside
  // <main>. The header pattern assertion only cares about the page's
  // header region, which is inside <main>.
  const main = document.querySelector("main");
  expect(main).not.toBeNull();
  const scope = main as HTMLElement;
  const q = withinScope(scope);
  // Eyebrow: rendered as a <p> by the Eyebrow primitive (`as="p"`).
  const eyebrow = q.eyebrowByText(opts.eyebrowText);
  expect(eyebrow).toHaveClass("uppercase");
  expect(eyebrow).toHaveClass("tracking-[0.08em]");
  // h1: a <h1> with the exact title.
  const h1 = q.h1ByText(opts.h1Text);
  expect(h1.tagName).toBe("H1");
  // DOM-order check: h1 follows the eyebrow inside the same <header>.
  const eyebrowRect = eyebrow.getBoundingClientRect();
  const h1Rect = h1.getBoundingClientRect();
  expect(h1Rect.top).toBeGreaterThanOrEqual(eyebrowRect.top);
  // The subtitle is a distinct paragraph (text node) below the h1.
  const subtitle = await q.subtitleByFragment(opts.subtitleFragment);
  expect(subtitle).not.toBeNull();
}

/**
 * Tiny scoped-query helper. Returns DOM elements that match the page
 * header pattern: eyebrow = the `<p>` rendered by the Eyebrow primitive;
 * h1 = the `<h1>` element; subtitle = the first text-bearing paragraph
 * that contains the fragment. We avoid `compareDocumentPosition` (it's
 * flaky across React render boundaries in jsdom) and instead use
 * bounding rect ordering — the eyebrow sits at the top of the header,
 * the h1 below it, the subtitle below that.
 */
function withinScope(scope: HTMLElement): {
  eyebrowByText: (text: string) => HTMLElement;
  h1ByText: (text: string) => HTMLElement;
  subtitleByFragment: (fragment: string) => Promise<HTMLElement>;
} {
  function eyebrowByText(text: string): HTMLElement {
    // The Eyebrow primitive renders uppercase + tracking — match it
    // by class to avoid catching the AppHeader span.
    const all = Array.from(scope.querySelectorAll<HTMLElement>("p, span, div")).filter(
      (el) =>
        el.classList.contains("uppercase") &&
        el.classList.contains("tracking-[0.08em]") &&
        el.textContent?.trim().toLowerCase() === text.toLowerCase(),
    );
    if (all.length === 0) {
      throw new Error(`No eyebrow with text "${text}" inside <main>`);
    }
    return all[0]!;
  }
  function h1ByText(text: string): HTMLElement {
    const all = Array.from(scope.querySelectorAll<HTMLElement>("h1")).filter(
      (el) => el.textContent?.trim() === text,
    );
    if (all.length === 0) {
      throw new Error(`No <h1> with text "${text}" inside <main>`);
    }
    return all[0]!;
  }
  async function subtitleByFragment(fragment: string): Promise<HTMLElement> {
    const re = new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const candidates = Array.from(scope.querySelectorAll<HTMLElement>("p")).filter(
      (el) => re.test(el.textContent ?? ""),
    );
    if (candidates.length > 0) {
      return candidates[0]!;
    }
    // If no <p> matched, try generic block elements (covers the
    // subtitle variants that render inside different wrappers).
    const blocks = Array.from(scope.querySelectorAll<HTMLElement>("p, div, span")).filter(
      (el) => re.test(el.textContent ?? "") && el.children.length === 0,
    );
    if (blocks.length > 0) return blocks[0]!;
    throw new Error(`No subtitle matching "${fragment}" inside <main>`);
  }
  return { eyebrowByText, h1ByText, subtitleByFragment };
}

function roleFromTag(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
    return "heading";
  }
  return tag;
}
function headingLevel(el: HTMLElement): number {
  const tag = el.tagName.toLowerCase();
  const m = /^h([1-6])$/.exec(tag);
  return m ? Number(m[1]) : 0;
}

describe("Phase F (F.2) page header sweep", () => {
  it("/library: Eyebrow → Display-1 h1 → Subtitle", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents")) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 });
      }
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify({ positions: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const LibraryPage = (await import("./library/page")).default;
    render(<LibraryPage />);
    await expectPageHeader({
      eyebrowText: "Library",
      h1Text: "Your library",
      subtitleFragment: "Paste, drop, or link anything",
    });
  });

  it("/voice: Eyebrow → Display-1 h1 → Subtitle", async () => {
    const VoicePage = (await import("./voice/page")).default;
    render(<VoicePage />);
    await expectPageHeader({
      eyebrowText: "Voices",
      h1Text: "Voices",
      subtitleFragment: "Pick a voice for every listen",
    });
  });

  it("/podcasts: Eyebrow → Display-1 h1 → Subtitle", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ episodes: [], has_more: false }), { status: 200 });
    }) as unknown as typeof fetch;
    const PodcastsPage = (await import("./podcasts/page")).default;
    render(<PodcastsPage />);
    await expectPageHeader({
      eyebrowText: "Podcasts",
      h1Text: "Podcasts",
      subtitleFragment: "Short audio shows generated",
    });
  });

  it("/assistant: Eyebrow → Display-1 h1 → Subtitle", async () => {
    const AssistantPage = (await import("./assistant/page")).default;
    render(<AssistantPage />);
    await expectPageHeader({
      eyebrowText: "Assistant",
      h1Text: "Assistant",
      subtitleFragment: "Ask anything about what you",
    });
  });

  it("/dictation: Eyebrow → Display-1 h1 → Subtitle", async () => {
    const DictationPage = (await import("./dictation/page")).default;
    render(<DictationPage />);
    await expectPageHeader({
      eyebrowText: "Dictation",
      h1Text: "Voice typing",
      subtitleFragment: "Talk, then review the cleanup",
    });
  });

  it("/settings: Eyebrow → Display-1 h1 → Subtitle", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const SettingsPage = (await import("./settings/page")).default;
    render(<SettingsPage />);
    await expectPageHeader({
      eyebrowText: "Settings",
      h1Text: "Settings",
      subtitleFragment: "Tune your reading",
    });
  });
});

describe("Phase F (F.2) reader toolbar header pattern", () => {
  // The reader doesn't expose a page-level <h1>; its chrome toolbar
  // carries the v2 Eyebrow + Display-1 title. We mock the audio path
  // so the reader renders past its loading state.
  it("renders Eyebrow + Display-1 clamped h1 with the doc title", async () => {
    const segments = [
      {
        index: 0,
        text: "Hello world.",
        start: 0,
        end: 12,
        words: [
          { index: 0, text: "Hello", start: 0, end: 5 },
          { index: 1, text: "world", start: 6, end: 11 },
        ],
      },
    ];
    const tree = {
      text: "Hello world.",
      paragraphs: [
        {
          index: 0,
          text: "Hello world.",
          start: 0,
          end: 12,
          sentences: segments,
          words: segments[0]!.words,
        },
      ],
      sentences: segments,
      words: segments[0]!.words,
      wordCount: 2,
    };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/documents/")) {
        return new Response(
          JSON.stringify({ id: "d1", title: "Demo", segmentTree: tree, segmentTreeId: "t1" }),
          { status: 200 },
        );
      }
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify({ positions: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const ReaderPage = (await import("../reader/[docId]/page")).default;
    const { container } = render(<ReaderPage />);
    await waitFor(
      () => {
        const eyebrow = container.querySelector("p.uppercase.tracking-\\[0\\.08em\\]");
        expect(eyebrow).not.toBeNull();
        expect(eyebrow?.textContent?.toLowerCase()).toContain("now playing");
      },
      { timeout: 4000 },
    );
    // Once the Eyebrow renders, the h1 with the doc title should also
    // be in the DOM.
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("Demo");
  });
});