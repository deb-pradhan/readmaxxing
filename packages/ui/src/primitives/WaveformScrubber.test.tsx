/**
 * WaveformScrubber primitive tests — visual scrubber with click-to-seek.
 *
 * Per DESIGN-SYSTEM §25.8: replaces the native `<input type="range">`
 * with a stylized bar track. Falls back to a hairline progress bar
 * when no peaks are available; click-to-seek always calls onSeek;
 * aria-label includes current/total time.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { WaveformScrubber } from "./WaveformScrubber";

describe("WaveformScrubber", () => {
  it("renders a slider role with current/total time in the aria-valuetext", () => {
    render(
      <WaveformScrubber currentTime={30} duration={120} />,
    );
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "0:30 / 2:00");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "120");
    expect(slider).toHaveAttribute("aria-valuenow", "30");
  });

  it("falls back to a synthetic peak set when no peaks prop is passed", () => {
    // No peaks → data-playing="false" attribute, but we still render
    // a bar track. The `prefers-reduced-motion` test stub keeps the
    // animation idle so this is a pure layout assertion.
    const { container } = render(
      <WaveformScrubber currentTime={0} duration={120} />,
    );
    expect(container.querySelector("[data-playing='false']")).not.toBeNull();
    // The bar track renders a row of inner bars (one per fallback peak).
    const bars = container.querySelectorAll("span.bg-ink, span.bg-ink\\/30");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("uses the supplied peaks when provided", () => {
    const { container } = render(
      <WaveformScrubber currentTime={60} duration={120} peaks={[0.1, 0.5, 0.9, 0.3, 0.7]} />,
    );
    expect(container.querySelector("[data-playing='true']")).not.toBeNull();
    const bars = container.querySelectorAll("span.bg-ink, span.bg-ink\\/30");
    expect(bars.length).toBe(5);
  });

  it("calls onSeek with the time corresponding to a click along the strip", () => {
    const onSeek = vi.fn();
    render(
      <WaveformScrubber
        currentTime={0}
        duration={100}
        peaks={[0.5, 0.5, 0.5, 0.5]}
        onSeek={onSeek}
      />,
    );
    const slider = screen.getByRole("slider");
    // Stub the bounding rect so the click x-coord maps cleanly. jsdom
    // returns 0×0 by default; without this override the seek math
    // resolves to NaN. We install a real `DOMRect` shape so the
    // `Math.min(width, clientX - left)` math doesn't degenerate.
    const rect = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 28,
      width: 100,
      height: 28,
      toJSON: () => ({}),
    } as DOMRect;
    slider.getBoundingClientRect = (): DOMRect => rect;
    // Use a Mouse-style fallback via `fireEvent.mouseDown` since
    // jsdom's pointer event plumbing is incomplete.
    fireEvent.mouseDown(slider, { clientX: 50 });
    expect(onSeek).toHaveBeenCalled();
    const calls = onSeek.mock.calls.map((c) => c[0]);
    expect(calls).toContain(50);
  });

  it("keyboard arrow keys nudge the playhead and call onSeek", () => {
    const onSeek = vi.fn();
    render(
      <WaveformScrubber
        currentTime={50}
        duration={100}
        peaks={[0.5, 0.5, 0.5, 0.5]}
        onSeek={onSeek}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenCalled();
    const lastCall = onSeek.mock.calls.at(-1)?.[0];
    expect(typeof lastCall).toBe("number");
    expect(lastCall).toBeGreaterThanOrEqual(50);
  });

  it("respects a custom aria-label", () => {
    render(
      <WaveformScrubber
        currentTime={0}
        duration={60}
        aria-label="Episode progress"
      />,
    );
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-label",
      "Episode progress",
    );
  });
});