/**
 * ReaderColumn primitive tests — single scroller + reduced-motion guard.
 *
 * - ReaderColumn renders the polite live region wrapper (`data-reading`).
 * - prefersReducedMotion() returns false by default; true under matchMedia.
 * - scrollBehavior(reducedMotion) returns 'auto' | 'smooth' accordingly.
 * - scrollCurrentSentenceIntoView lands the element in the upper third
 *   and gates `behavior: smooth` on reduced-motion.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import {
  ReaderColumn,
  prefersReducedMotion,
  scrollBehavior,
  scrollCurrentSentenceIntoView,
} from "./ReaderColumn";
import { buildSegmentTree } from "@readmaxxing/core";

const SAMPLE = "Hello world. Again here.";
const TREE = buildSegmentTree(SAMPLE, { documentId: "r1" });

describe("ReaderColumn", () => {
  it("renders the data-reading container + reading-column class", () => {
    const { container } = render(
      <ReaderColumn tree={TREE} currentWordIndex={0} />,
    );
    const wrapper = container.querySelector("[data-reading='true']");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("mx-auto");
  });

  it("scrollBehavior honors prefers-reduced-motion", () => {
    expect(scrollBehavior(true)).toBe("auto");
    expect(scrollBehavior(false)).toBe("smooth");
  });

  it("prefersReducedMotion() reads from matchMedia", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    const originalMM = window.matchMedia;
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = originalMM;
  });

  it("scrollCurrentSentenceIntoView lands in the upper third + uses smooth scroll", () => {
    const scrollTo = vi.fn();
    const fakeEl = {
      getBoundingClientRect: () => ({ top: 200, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    const getElementById = vi.spyOn(document, "getElementById").mockReturnValue(fakeEl);
    const originalScrollTo = window.scrollTo;
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 600, writable: true, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
    const el = scrollCurrentSentenceIntoView({
      container: window,
      paragraphIndex: 0,
    });
    expect(el).toBe(fakeEl);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const [arg] = scrollTo.mock.calls[0] ?? [];
    console.log("scrollTo arg:", arg, "window.scrollY:", window.scrollY, "isWindow:", window instanceof Window);
    expect(arg).toMatchObject({ behavior: "smooth" });
    expect((arg as { top: number }).top).toBe(0);
    getElementById.mockRestore();
    Object.defineProperty(window, "scrollTo", { value: originalScrollTo, writable: true });
  });

  it("scrollCurrentSentenceIntoView no-ops in SSR", () => {
    // In jsdom the document is still defined; this verifies the function
    // returns null when the target element is missing (the only SSR-safe path).
    const getElementById = vi
      .spyOn(document, "getElementById")
      .mockReturnValue(null);
    const el = scrollCurrentSentenceIntoView({
      container: null,
      paragraphIndex: 99,
    });
    expect(el).toBeNull();
    getElementById.mockRestore();
  });

  it("scrollCurrentSentenceIntoView uses 'auto' under reduced-motion", () => {
    const scrollTo = vi.fn();
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    const originalMM = window.matchMedia;
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const fakeEl = {
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    const getElementById = vi.spyOn(document, "getElementById").mockReturnValue(fakeEl);
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 600, writable: true, configurable: true });
    scrollCurrentSentenceIntoView({ container: window, paragraphIndex: 0 });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    getElementById.mockRestore();
    window.matchMedia = originalMM;
  });
});