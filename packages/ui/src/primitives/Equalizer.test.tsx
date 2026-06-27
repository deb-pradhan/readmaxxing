/**
 * Equalizer primitive tests — animated 3-bar equalizer.
 *
 * Per DESIGN-SYSTEM §25.8: equalizer animates only when `playing`
 * is true. Honors `prefers-reduced-motion` (renders static when
 * reduced). Defaults to aria-hidden decorative.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { Equalizer } from "./Equalizer";

function makeMatchMedia(matches: boolean): typeof window.matchMedia {
  return ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("Equalizer", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: makeMatchMedia(false),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a decorative span (aria-hidden) by default", () => {
    const { container } = render(<Equalizer playing={true} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-playing", "true");
    expect(root).toHaveAttribute("role", "presentation");
  });

  it("uses data-playing=false when paused", () => {
    const { container } = render(<Equalizer playing={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-playing", "false");
  });

  it("renders three bars inside the equalizer", () => {
    const { container } = render(<Equalizer playing={true} size={20} />);
    const bars = container.querySelectorAll("span.bg-current");
    expect(bars.length).toBe(3);
  });

  it("data-reduced-motion flag is wired through matchMedia", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: makeMatchMedia(true),
    });
    const { container } = render(<Equalizer playing={true} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-reduced-motion", "true");
  });

  it("respects the size prop (16 or 20)", () => {
    const { container: c16 } = render(<Equalizer playing={true} size={16} />);
    const { container: c20 } = render(<Equalizer playing={true} size={20} />);
    expect(c16.firstElementChild).toHaveStyle({ width: "16px", height: "16px" });
    expect(c20.firstElementChild).toHaveStyle({ width: "20px", height: "20px" });
  });
});