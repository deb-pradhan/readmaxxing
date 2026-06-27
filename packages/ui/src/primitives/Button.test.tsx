/**
 * Button primitive tests — pill shape, AA contrast, token hover.
 *
 * Per DESIGN-SYSTEM §25.5 + UI-UX-AUDIT B-fix:
 * - variant="primary" must compute to a coral-600 fill (no hex literal).
 * - hover uses a token-derived shade (no hex literal in computed style).
 * - All buttons are pills (rounded-full) — never rounded-md.
 * - Three heights: 36 / 44 / 52.
 * - Pill shape + circle only — no rounded-square buttons anywhere.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with a default variant (primary) and default size (md, 44px)", () => {
    render(<Button>Continue</Button>);
    const btn = screen.getByRole("button", { name: "Continue" });
    expect(btn).toHaveClass("rounded-full");
    expect(btn).toHaveClass("h-11"); // 44px
  });

  it("uses the pill shape (rounded-full) — never rounded-md", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
    rerender(<Button variant="secondary">B</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
    rerender(<Button variant="ghost">C</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
  });

  it("emits no hex literal in the rendered className (token-driven)", () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="inverse">Inverse</Button>
      </>,
    );
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      // Tailwind arbitrary value: `bg-[#xxx]` is a forbidden pattern.
      expect(btn.className).not.toMatch(/bg-\[#/);
      expect(btn.className).not.toMatch(/hover:bg-\[#/);
      expect(btn.className).not.toMatch(/text-\[#/);
    }
  });

  it("variant=primary uses coral-600 token (AA-safe contrast)", () => {
    render(<Button variant="primary">Save</Button>);
    const btn = screen.getByRole("button");
    // bg-coral-600 maps to var(--coral-600), the AA-passing shade.
    expect(btn).toHaveClass("bg-coral-600");
    expect(btn).toHaveClass("text-white");
  });

  it("heights: sm=36, md=44, lg=52", () => {
    const { rerender } = render(<Button size="sm">sm</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9"); // 36px
    rerender(<Button size="md">md</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-11"); // 44px
    rerender(<Button size="lg">lg</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-[3.25rem]"); // 52px
  });

  it("renders an icon when the icon prop is supplied", () => {
    render(<Button icon="arrow-up-right">Confirm</Button>);
    const btn = screen.getByRole("button");
    // The Lucide icon renders an <svg> inside the button.
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders <Button.Icon> custom nodes", () => {
    const { container } = render(
      <Button>
        <Button.Icon>
          <span data-testid="custom-icon">★</span>
        </Button.Icon>
        Starred
      </Button>,
    );
    expect(container.querySelector("[data-testid='custom-icon']")).not.toBeNull();
  });

  it("loading state shows the spinner and keeps the label", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    // Spinner is a styled <span aria-hidden> with animate-spin.
    const spinner = btn.querySelector("span[aria-hidden]");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass("animate-spin");
    expect(btn.textContent).toContain("Save");
    expect(btn).toBeDisabled();
  });
});