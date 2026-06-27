/**
 * StreakRing primitive tests — token-driven SVG strokes (no hex literal).
 *
 * Per audit + DESIGN-SYSTEM §25.1: SVG strokes/fills read CSS variables
 * so e-ink remap applies. **No hex literal** in the rendered output for
 * any of the 4 themes.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { StreakRing } from "./StreakRing";

describe("StreakRing (token-driven)", () => {
  it("renders the streak count with mono numerals", () => {
    render(<StreakRing days={7} />);
    const count = screen.getByText("7");
    expect(count).toHaveClass("font-mono");
    expect(count).toHaveClass("tabular-nums");
  });

  it("aria-label includes the day count + state", () => {
    render(<StreakRing days={5} todayActive />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "5-day streak");
  });

  it("data-state reflects the active / idle / at-risk mode", () => {
    const { rerender } = render(<StreakRing days={3} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-state", "idle");
    rerender(<StreakRing days={3} todayActive />);
    expect(screen.getByRole("img")).toHaveAttribute("data-state", "active");
    rerender(<StreakRing days={3} atRisk />);
    expect(screen.getByRole("img")).toHaveAttribute("data-state", "at-risk");
  });

  it("SVG stroke/fill attributes use CSS variables — no hex literal", () => {
    const { container } = render(<StreakRing days={5} todayActive />);
    const html = container.innerHTML;
    // No hex colors in the rendered output.
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
    // Stroke attributes resolve via CSS vars.
    const strokeValues = Array.from(container.querySelectorAll<SVGElement>("[stroke]"))
      .map((el) => el.getAttribute("stroke"))
      .filter(Boolean);
    for (const v of strokeValues) {
      expect(v).toMatch(/^var\(--/);
    }
  });
});