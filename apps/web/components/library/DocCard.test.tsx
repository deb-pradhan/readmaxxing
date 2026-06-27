/**
 * DocCard component tests — Phase F (F.4).
 *
 * Pins the v2 visual contract for a single document in the library
 * grid:
 *   - CoverArt renders (decorative) with the document id as seed.
 *   - The title is exposed via the surrounding <h3>.
 *   - The source tag uses the shared Chip primitive (no hand-rolled
 *     soft-fill span).
 *   - The whole card is one <button> with an "Open <title>" label.
 *   - No raw hex literals in the rendered markup.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

import { DocCard } from "./DocCard";

describe("DocCard (Phase F — F.4)", () => {
  it("renders CoverArt with the document id as seed (decorative)", () => {
    const { container } = render(
      <DocCard id="doc-abc" title="Hello world" sourceType="pdf" />,
    );
    const cover = container.querySelector("[data-cover-seed]");
    expect(cover).not.toBeNull();
    expect((cover as HTMLElement).getAttribute("data-cover-seed")).toBe("doc-abc");
    // CoverArt is decorative by default — its title is exposed via h3.
    expect(cover?.getAttribute("aria-hidden")).toBe("true");
    expect(cover?.getAttribute("role")).toBeNull();
  });

  it("exposes the title via the surrounding <h3>", () => {
    render(<DocCard id="doc-xyz" title="A test document" sourceType="paste" />);
    const heading = screen.getByRole("heading", { level: 3, name: "A test document" });
    expect(heading.tagName).toBe("H3");
  });

  it("renders the source tag via the shared Chip primitive", () => {
    const { container } = render(<DocCard id="d" title="t" sourceType="pdf" />);
    // The Chip primitive renders as a span with a `rounded-full` class.
    // We don't pin the exact color — we pin the *token* wiring (chip
    // variant) by checking that the chip is rendered and the source
    // label is "PDF".
    const chipText = screen.getByText("PDF");
    expect(chipText).toBeInTheDocument();
    // The Chip wraps its label in an inner <span class="leading-none">.
    const chip = chipText.closest("span.rounded-full");
    expect(chip).not.toBeNull();
    // Token-only: no inline hex / color styles.
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });

  it("the whole card is one accessible <button> with 'Open <title>' label", () => {
    render(<DocCard id="d1" title="My doc" sourceType="pdf" />);
    const button = screen.getByRole("button", { name: /open my doc/i });
    expect(button).toBeInTheDocument();
  });

  it("renders the words + read-time meta when provided", () => {
    render(
      <DocCard
        id="d1"
        title="My doc"
        sourceType="paste"
        wordCount={1500}
        readTimeSeconds={600}
      />,
    );
    // 1500 words → 1,500 (locale formatted) with mono tabular numerals.
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
    expect(screen.getByText(/10 min/)).toBeInTheDocument();
  });
});