/**
 * Icon primitive tests — Lucide wrapper.
 *
 * Per DESIGN-SYSTEM §25.4:
 * - Decorative by default (aria-hidden=true).
 * - aria-label switches the icon to a meaningful image role.
 * - Three sizes; strokeWidth pass-through.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders a named Lucide icon as an SVG", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is decorative by default (aria-hidden=true, no role)", () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("becomes a meaningful image when aria-label is provided", () => {
    render(<Icon name="check" aria-label="Confirm" />);
    const svg = screen.getByRole("img", { name: "Confirm" });
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("supports 16/20/24 sizes", () => {
    const { rerender, container } = render(<Icon name="check" size={16} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "16");
    rerender(<Icon name="check" size={20} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
    rerender(<Icon name="check" size={24} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "24");
  });

  it("accepts a custom className and passes through SVG attributes", () => {
    const { container } = render(
      <Icon name="check" className="text-coral-600" data-testid="check-icon" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-coral-600");
    expect(svg).toHaveAttribute("data-testid", "check-icon");
  });

  it("warns and renders null for unknown icon names", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = render(<Icon name={"not-a-real-icon" as unknown as "check"} />);
    expect(container.firstChild).toBeNull();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});

// vitest globals are enabled in vitest.setup.ts; declare to satisfy tsc.
declare const vi: { spyOn: typeof import("vitest").vi.spyOn };