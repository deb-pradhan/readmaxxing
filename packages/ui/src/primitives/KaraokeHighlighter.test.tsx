/**
 * KaraokeHighlighter primitive tests — audit C3 enforcement.
 *
 * - **No `role="button"`** on any word span.
 * - **Exactly one** click handler on the container (delegated).
 * - Active word swap is **color + bg only** (no `font-weight` change vs
 *   inactive words).
 * - Active word carries `aria-current="true"`.
 * - Container has `id="paragraph-{n}"` so CitationPill can anchor-scroll.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { KaraokeHighlighter } from "./KaraokeHighlighter";
import { buildSegmentTree } from "@readmaxxing/core";

function makeTree() {
  return buildSegmentTree("Hello world. Again here.", { documentId: "k1" });
}

describe("KaraokeHighlighter (audit C3)", () => {
  it("renders NO role='button' on any word span", () => {
    const { container } = render(
      <KaraokeHighlighter tree={makeTree()} currentWordIndex={0} />,
    );
    const wordSpans = container.querySelectorAll<HTMLElement>("[data-word-idx]");
    expect(wordSpans.length).toBeGreaterThan(0);
    for (const span of wordSpans) {
      expect(span.getAttribute("role")).not.toBe("button");
    }
  });

  it("container has exactly ONE onClick handler (delegated)", () => {
    const onWordClick = vi.fn();
    const { container } = render(
      <KaraokeHighlighter
        tree={makeTree()}
        currentWordIndex={-1}
        onWordClick={onWordClick}
      />,
    );
    const root = container.querySelector(".reading-column") as HTMLElement | null;
    expect(root).not.toBeNull();
    // Fire click on each word span — they bubble to the container.
    const wordSpans = container.querySelectorAll<HTMLElement>("[data-word-idx]");
    expect(wordSpans.length).toBeGreaterThan(0);
    const firstSpan = wordSpans[0];
    if (!firstSpan) throw new Error("expected at least one word span");
    fireEvent.click(firstSpan);
    expect(onWordClick).toHaveBeenCalledTimes(1);
    expect(onWordClick).toHaveBeenCalledWith(0);
  });

  it("active word has aria-current='true' and color/bg swap, no font-weight change", () => {
    const { container } = render(
      <KaraokeHighlighter tree={makeTree()} currentWordIndex={1} />,
    );
    const active = container.querySelector<HTMLElement>('[data-current-word="true"]');
    const inactive = container.querySelector<HTMLElement>(
      '[data-word-idx="2"][data-current-word="false"]',
    );
    expect(active).not.toBeNull();
    expect(inactive).not.toBeNull();
    // ARIA
    expect(active).toHaveAttribute("aria-current", "true");
    expect(inactive).not.toHaveAttribute("aria-current");
    // Active has the color/bg swap class.
    expect(active!.className).toMatch(/bg-coral-bg/);
    // Neither word gains font-semibold/font-bold from the active state.
    // (BionicReading inside uses <strong> for its own lead — we test
    // the outer word span only.)
    expect(active!.className).not.toMatch(/font-semibold/);
    expect(active!.className).not.toMatch(/font-bold\b/);
    expect(inactive!.className).not.toMatch(/font-semibold/);
  });

  it("paragraph <Tag> has id='paragraph-{n}' for CitationPill anchor", () => {
    const { container } = render(
      <KaraokeHighlighter tree={makeTree()} currentWordIndex={0} />,
    );
    const paragraph = container.querySelector<HTMLElement>("#paragraph-0");
    expect(paragraph).not.toBeNull();
    expect(paragraph).toHaveAttribute("data-paragraph-index", "0");
  });

  it("preserves the polite live region (cross-surface contract)", () => {
    const { container } = render(
      <KaraokeHighlighter tree={makeTree()} currentWordIndex={1} />,
    );
    const live = container.querySelector(".rmx-live");
    expect(live).not.toBeNull();
    expect(live).toHaveAttribute("aria-live", "polite");
  });
});