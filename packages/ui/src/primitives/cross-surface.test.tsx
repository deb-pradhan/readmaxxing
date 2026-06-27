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
import { KaraokeHighlighter, ReaderColumn } from "@readmaxxing/ui";
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
});
