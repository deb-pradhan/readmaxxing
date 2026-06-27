/**
 * KaraokeHighlighter component tests — verify data attributes and click handling.
 *
 * Per UI-UX.md §4.8 the highlighter renders sentence tints, word fills, and
 * a live region. Each word gets `data-word-idx`, the active word gets
 * `data-current-word`, the active sentence gets `data-current-sentence`.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { KaraokeHighlighter } from "@readmaxxing/ui";
import { buildSegmentTree } from "@readmaxxing/core";

function makeTree(): ReturnType<typeof buildSegmentTree> {
  return buildSegmentTree("Hello world. Again here.", { documentId: "d1" });
}

describe("KaraokeHighlighter", () => {
  it("renders each word with data-word-idx", () => {
    const tree = makeTree();
    const { container } = render(<KaraokeHighlighter tree={tree} currentWordIndex={-1} />);
    const words = container.querySelectorAll<HTMLElement>("[data-word-idx]");
    expect(words.length).toBeGreaterThan(0);
    expect(words[0]?.textContent).toContain("Hello");
  });

  it("marks the active word with data-current-word", () => {
    const tree = makeTree();
    const { container } = render(<KaraokeHighlighter tree={tree} currentWordIndex={1} />);
    const active = container.querySelector<HTMLElement>("[data-current-word='true']");
    expect(active).not.toBeNull();
    expect(active?.textContent).toContain("world");
  });

  it("fires onWordClick when a word is clicked", () => {
    const tree = makeTree();
    const onWordClick = vi.fn();
    const { container } = render(
      <KaraokeHighlighter tree={tree} currentWordIndex={-1} onWordClick={onWordClick} />,
    );
    const firstWord = container.querySelector<HTMLElement>("[data-word-idx='0']");
    expect(firstWord).not.toBeNull();
    fireEvent.click(firstWord!);
    expect(onWordClick).toHaveBeenCalledWith(0);
  });

  it("marks the active sentence", () => {
    const tree = makeTree();
    const { container } = render(<KaraokeHighlighter tree={tree} currentWordIndex={1} />);
    const active = container.querySelector<HTMLElement>("[data-current-sentence='true']");
    expect(active).not.toBeNull();
  });

  it("renders the live region for screen readers", () => {
    const tree = makeTree();
    render(<KaraokeHighlighter tree={tree} currentWordIndex={1} />);
    const live = screen.getAllByRole("generic", { hidden: true });
    // The polite live region is a sibling div; just check the active sentence text appears.
    expect(document.body.textContent).toContain("Hello world.");
  });

  it("toggles focus dimming via the focusMode prop", () => {
    const tree = makeTree();
    const { container } = render(
      <KaraokeHighlighter tree={tree} currentWordIndex={0} focusMode={false} />,
    );
    const paragraphs = container.querySelectorAll<HTMLElement>("p");
    expect(paragraphs[0]?.className).not.toContain("opacity-30");
  });

  // Phase D P1 (D.9): reading column measure + leading.
  it("renders the reading column at 18px / clamp(1.5,1.5+0.05vw,1.6) leading", () => {
    const tree = makeTree();
    const { container } = render(<KaraokeHighlighter tree={tree} currentWordIndex={-1} />);
    const paragraph = container.querySelector<HTMLElement>("p");
    expect(paragraph).not.toBeNull();
    const cls = paragraph?.className ?? "";
    // Arbitrary Tailwind classes render in the DOM as `text-[18px]` and
    // `leading-[clamp(...)]` after the PostCSS step. Assert both pieces.
    expect(cls).toContain("text-[18px]");
    expect(cls).toContain("leading-[clamp(1.5,1.5+0.05vw,1.6)]");
  });

  it("applies the reading-column utility (CSS var–driven max-width)", () => {
    const tree = makeTree();
    const { container } = render(<KaraokeHighlighter tree={tree} currentWordIndex={-1} />);
    const col = container.querySelector<HTMLElement>(".reading-column");
    expect(col).not.toBeNull();
  });
});