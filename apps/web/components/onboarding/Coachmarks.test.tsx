/**
 * Coachmarks — Phase D P1 (D.4) verification.
 *
 * Pins the behavior:
 *   - Lazy-mount via scroll: when `immediate=false`, the popover does
 *     not appear until the user scrolls at least once.
 *   - First-3-sessions gate: when `SESSIONS >= 3` in localStorage, the
 *     popover stays hidden.
 *   - `prefers-reduced-motion`: when the user prefers reduced motion,
 *     the popover does NOT include a transition class (it just renders
 *     instantly — no fade).
 *   - `data-coachmark-step` + `data-coachmark-active` attributes are set
 *     so the consumer can position the popover near the targeted
 *     toolbar element via `data-coachmark-target`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

import { Coachmarks } from "./Coachmarks";

const STORAGE_KEY = "rmx-coachmarks-seen";
const SESSION_KEY = "rmx-coachmarks-sessions";

describe("Coachmarks (Phase D P1 — D.4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders nothing when immediate=false and the user has not scrolled", () => {
    render(<Coachmarks />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("lazy-mounts after the first scroll event", async () => {
    render(<Coachmarks />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // Fire a scroll event.
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("renders immediately when immediate=true (used by tests + first session)", () => {
    render(<Coachmarks immediate />);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("does not render when the user has already completed the tour (STORAGE_KEY=1)", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<Coachmarks immediate />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not render after MAX_SESSIONS (3) sessions on a fresh device", () => {
    window.localStorage.setItem(SESSION_KEY, "3");
    render(<Coachmarks immediate />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("increments the session counter on first mount of a new device", () => {
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    render(<Coachmarks immediate />);
    // First session — counter is now 1.
    expect(window.localStorage.getItem(SESSION_KEY)).toBe("1");
  });

  it("advances steps and dismisses on the final Next", () => {
    render(<Coachmarks immediate />);
    // The first step shows "Tap to play".
    expect(screen.getByText(/Tap to play/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Step 2.
    expect(screen.getByText(/Adjust speed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Step 3 — last step. The button label flips to "Got it".
    expect(screen.getByText(/Read along/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    // Tour gone + STORAGE_KEY set.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("dismisses and persists when Skip is clicked", () => {
    render(<Coachmarks immediate />);
    // The bottom-row "Skip tour" text button (vs. the aria-label="Skip
    // tour" icon button — both exist; we want the text one).
    const skipBtns = screen.getAllByRole("button", { name: "Skip tour" });
    fireEvent.click(skipBtns[skipBtns.length - 1]!);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("emits data-coachmark-step + data-coachmark-active attributes", () => {
    render(<Coachmarks immediate />);
    const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.dataset.coachmarkStep).toBe("play");
    expect(dlg.dataset.coachmarkActive).toBe("reader-toolbar");
  });

  it("omits the transition class when prefers-reduced-motion is set", () => {
    // Stub matchMedia for this test only.
    const original = window.matchMedia;
    window.matchMedia = vi.fn((q: string) => {
      if (q === "(prefers-reduced-motion: reduce)") {
        return { matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList;
      }
      return original ? original(q) : ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
    });
    try {
      render(<Coachmarks immediate />);
      const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
      // Reduced motion ⇒ no `transition-opacity` class on the popover.
      expect(dlg.className).not.toContain("transition-opacity");
    } finally {
      window.matchMedia = original;
    }
  });
});