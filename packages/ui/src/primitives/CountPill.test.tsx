/**
 * CountPill primitive tests — mono numeral + superscript badge.
 *
 * Per DESIGN-SYSTEM §25.2 + §25.8: numerals are mono + tabular;
 * superscript label renders at 0.55em.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { CountPill } from "./CountPill";

describe("CountPill", () => {
  it("renders a formatted number with tabular-nums", () => {
    render(<CountPill count={1240} label="words" />);
    const formatted = screen.getByText("1,240");
    expect(formatted).toHaveClass("tabular-nums");
    expect(formatted).toHaveClass("font-mono");
  });

  it("renders the superscript label at 0.55em", () => {
    render(<CountPill count={12} label="tracks" />);
    const label = screen.getByText("tracks");
    expect(label).toHaveClass("text-[0.55em]");
    expect(label).toHaveAttribute("aria-hidden", "true");
  });

  it("tone=accent uses the coral text token", () => {
    render(<CountPill count={12} tone="accent" />);
    // The tone class lands on the outer <span> (the parent of the numeral span).
    const numeral = screen.getByText("12");
    expect(numeral.parentElement).toHaveClass("text-coral-text");
  });

  it("accepts a string count without formatting", () => {
    render(<CountPill count="Featured" />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });
});