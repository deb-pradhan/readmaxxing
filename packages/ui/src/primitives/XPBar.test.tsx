/**
 * XPBar primitive tests — token-driven SVG strokes (no hex literal).
 *
 * Per audit + DESIGN-SYSTEM §25.1.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { XPBar } from "./XPBar";

const BASE_PROPS = {
  todayXp: 600,
  dailyGoalXp: 1000,
  totalXp: 5000,
  currentLevelXp: 4000,
  nextLevelXp: 7000,
  level: 2,
};

describe("XPBar (token-driven)", () => {
  it("renders the daily XP percentage with mono numerals", () => {
    render(<XPBar {...BASE_PROPS} />);
    const pct = screen.getByText("60%");
    expect(pct).toHaveClass("font-mono");
    expect(pct).toHaveClass("tabular-nums");
  });

  it("shows the 'Goal met' line when dailyGoalXp is reached", () => {
    render(<XPBar {...BASE_PROPS} todayXp={1500} />);
    expect(screen.getByText(/Goal met/i)).toBeInTheDocument();
  });

  it("formats the XP figures with tabular-nums", () => {
    render(<XPBar {...BASE_PROPS} />);
    // The meta line shows "5,000 / 7,000 XP" with tabular-nums.
    const meta = screen.getByText(/5,000 \/ 7,000 XP/);
    expect(meta).toHaveClass("font-mono");
  });

  it("SVG stroke/fill attributes use CSS variables — no hex literal", () => {
    const { container } = render(<XPBar {...BASE_PROPS} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
    const strokeValues = Array.from(container.querySelectorAll<SVGElement>("[stroke]"))
      .map((el) => el.getAttribute("stroke"))
      .filter(Boolean);
    for (const v of strokeValues) {
      expect(v).toMatch(/^var\(--/);
    }
  });
});