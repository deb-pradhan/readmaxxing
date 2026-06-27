/**
 * Eyebrow primitive tests — UPPERCASE + tracked micro-label.
 *
 * Per DESIGN-SYSTEM §25.2: 11–12px, weight 600, +0.08em tracking.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders uppercase + tracked micro-label by default (span)", () => {
    render(<Eyebrow>Now playing</Eyebrow>);
    const el = screen.getByText("Now playing");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("uppercase");
    expect(el).toHaveClass("tracking-[0.08em]");
    expect(el).toHaveClass("font-semibold");
    expect(el).toHaveClass("text-[11px]");
  });

  it("respects the `as` prop (div / p / span)", () => {
    const { rerender } = render(<Eyebrow as="span">S</Eyebrow>);
    expect(screen.getByText("S").tagName).toBe("SPAN");
    rerender(<Eyebrow as="div">D</Eyebrow>);
    expect(screen.getByText("D").tagName).toBe("DIV");
    rerender(<Eyebrow as="p">P</Eyebrow>);
    expect(screen.getByText("P").tagName).toBe("P");
  });
});