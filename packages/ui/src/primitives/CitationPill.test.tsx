/**
 * CitationPill primitive tests — ↗¶N citation anchor.
 *
 * Per D12 + UI-UX-AUDIT C4:
 * - Renders ↗ + ¶ + (paragraphIndex + 1).
 * - aria-label includes paragraph + sentence when sentenceIndex is set.
 * - Custom onClick wins; otherwise defaults to scrolling to #paragraph-{n}.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { CitationPill } from "./CitationPill";

describe("CitationPill", () => {
  it("renders ↗ + ¶ + 1-based paragraph index", () => {
    render(<CitationPill paragraphIndex={2} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("↗");
    expect(btn.textContent).toContain("¶");
    expect(btn.textContent).toContain("3"); // paragraphIndex + 1
  });

  it("aria-label includes paragraph + sentence when sentenceIndex is set", () => {
    render(<CitationPill paragraphIndex={0} sentenceIndex={2} />);
    expect(
      screen.getByRole("button", { name: /paragraph 1, sentence 3/i }),
    ).toBeInTheDocument();
  });

  it("aria-label is just paragraph when sentenceIndex is omitted", () => {
    render(<CitationPill paragraphIndex={4} />);
    expect(
      screen.getByRole("button", { name: /paragraph 5/i }),
    ).toBeInTheDocument();
  });

  it("calls a custom onClick when provided", () => {
    const onClick = vi.fn();
    render(<CitationPill paragraphIndex={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses a real <button> element (focusable)", () => {
    render(<CitationPill paragraphIndex={0} />);
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});