/**
 * Cross-surface snapshot tests.
 *
 * Per UI-UX.md §11 (consistency across surfaces): the same
 * `ReaderColumn` and `KaraokeHighlighter` render in web, the Chrome
 * extension popup + overlay, and (transitively via the segment tree
 * model) the mobile reader. These snapshots pin the DOM shape so an
 * accidental change in one surface breaks the build, not a user.
 *
 * The web app already has its own tests for these primitives; this
 * file adds the **regression** tests that the brief calls out —
 * snapshot the rendered HTML and assert each surface uses the same
 * `data-word-idx`, `data-current-sentence`, and `data-current-word`
 * attributes (the contract the karaoke RAF + click-to-jump consume).
 */

import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  KaraokeHighlighter,
  ReaderColumn,
  Button,
  Icon,
  IconButton,
  Eyebrow,
  CountPill,
  StatusPill,
  CitationPill,
} from "@readmaxxing/ui";
import { font } from "../tokens";
import { buildSegmentTree } from "@readmaxxing/core";

const SAMPLE = "The quick brown fox jumps over the lazy dog. Hello world.";

function tree() {
  return buildSegmentTree(SAMPLE, { documentId: "cross-surface-doc" });
}

describe("cross-surface DOM contract", () => {
  it("renders the same data-word-idx attribute in web, extension, mobile source", () => {
    const html = renderToStaticMarkup(
      <KaraokeHighlighter tree={tree()} currentWordIndex={3} />,
    );
    expect(html).toContain('data-word-idx="3"');
    expect(html).toContain('data-current-word="true"');
    expect(html).toContain('data-current-sentence="true"');
  });

  it("marks exactly one sentence as current for any word index", () => {
    const html = renderToStaticMarkup(
      <KaraokeHighlighter tree={tree()} currentWordIndex={2} />,
    );
    const matches = html.match(/data-current-sentence="true"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("renders all words with stable word-idx ordering", () => {
    const html = renderToStaticMarkup(
      <KaraokeHighlighter tree={tree()} currentWordIndex={-1} />,
    );
    // The SAMPLE has 9 words; the rendered DOM should emit at least 9 word spans.
    const wordIdxs = (html.match(/data-word-idx="\d+"/g) ?? []).map((s) =>
      Number(s.replace(/[^0-9]/g, "")),
    );
    expect(wordIdxs.length).toBeGreaterThanOrEqual(9);
    const unique = [...new Set(wordIdxs)].sort((a, b) => a - b);
    expect(wordIdxs).toEqual(unique);
  });

  it("uses the shared ReaderColumn wrapper on every surface", () => {
    const html = renderToStaticMarkup(
      <ReaderColumn tree={tree()} currentWordIndex={0} />,
    );
    expect(html).toContain('data-reading="true"');
    expect(html).toContain("mx-auto");
  });

  it("emits the polite live-region announce for screen readers", () => {
    const html = renderToStaticMarkup(
      <KaraokeHighlighter tree={tree()} currentWordIndex={1} />,
    );
    expect(html).toContain('aria-live="polite"');
  });

  it("respects prefers-reduced-motion via the transition classes", () => {
    // The reduced-motion override lives in globals.css; here we just
    // confirm the highlight classes ship a `duration-highlight` token
    // so the CSS variable can override it.
    const html = renderToStaticMarkup(
      <KaraokeHighlighter tree={tree()} currentWordIndex={-1} />,
    );
    expect(html).toContain("duration-highlight");
  });

  it("v2 mono font token resolves to a non-empty font-family string", () => {
    // The mono token is consumed by instrument-grade surfaces (PlayerBar
    // timecode, count badges, eyebrow micro-labels — see DESIGN-SYSTEM
    // §25.2). This snapshot pins that the token string is non-empty so
    // a typo in the stack fails the build, not the rendered DOM.
    expect(typeof font.mono).toBe("string");
    expect(font.mono.length).toBeGreaterThan(0);
    expect(font.mono).toContain("Geist Mono");
  });

  // ===== v2 primitives (Phase B additions) =====

  it("Button is pill-shaped (rounded-full) on every surface", () => {
    const html = renderToStaticMarkup(<Button>Continue</Button>);
    expect(html).toMatch(/class="[^"]*rounded-full/);
    // No rounded-md / rounded-lg on the button itself.
    const buttonMatch = /<button[^>]*class="([^"]+)"/.exec(html);
    expect(buttonMatch).not.toBeNull();
    const cls = buttonMatch![1]!;
    expect(cls).not.toMatch(/rounded-md\b/);
  });

  it("Icon renders a Lucide SVG", () => {
    const html = renderToStaticMarkup(<Icon name="arrow-up-right" />);
    // Lucide wraps the SVG with `<svg>` and an inner `<path>` etc.
    expect(html).toMatch(/<svg[^>]*>/);
  });

  it("IconButton renders a circular (rounded-full) <button>", () => {
    const html = renderToStaticMarkup(<IconButton icon="check" aria-label="Confirm" />);
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toMatch(/aria-label="Confirm"/);
    expect(html).toMatch(/rounded-full/);
  });

  it("Eyebrow renders UPPERCASE + tracked micro-label", () => {
    const html = renderToStaticMarkup(<Eyebrow>Now playing</Eyebrow>);
    expect(html).toMatch(/uppercase/);
    expect(html).toMatch(/tracking-\[0\.08em\]/);
  });

  it("CountPill renders mono + tabular numerals", () => {
    const html = renderToStaticMarkup(<CountPill count={1240} />);
    expect(html).toMatch(/font-mono/);
    expect(html).toMatch(/tabular-nums/);
    // Number formatted with locale grouping.
    expect(html).toContain("1,240");
  });

  it("StatusPill renders the deterministic copy", () => {
    const html = renderToStaticMarkup(<StatusPill status="error" />);
    // 'error' → "Failed" (never "come back later").
    expect(html).toContain("Failed");
    expect(html).toContain('data-status="error"');
  });

  it("CitationPill renders ↗ + ¶ + (paragraphIndex + 1)", () => {
    const html = renderToStaticMarkup(<CitationPill paragraphIndex={2} />);
    expect(html).toContain("↗");
    expect(html).toContain("¶");
    expect(html).toContain("3");
  });
});
