"use client";

/**
 * ReaderColumn — the 66ch reading surface (DESIGN-SYSTEM §3.5 + §6.5 + §25.9).
 *
 * Thin wrapper around `KaraokeHighlighter`. Inter is the only family;
 * the body is 15px with line-height 1.5.
 *
 * The wrapper itself doesn't own any auto-scroll behavior — the
 * reader page is the only consumer today, and it owns both a
 * word/center and a sentence/start auto-scroller (UI-UX-AUDIT "two
 * competing auto-scrollers"). Phase D will collapse those into one
 * sentence-anchored scroller; Phase B exposes the *helpers* so the
 * page can adopt them with no API break.
 *
 * Exported helpers (Phase B):
 *   - `prefersReducedMotion()` — `matchMedia` predicate (SSR-safe)
 *   - `scrollBehavior(reducedMotion)` — returns "auto" | "smooth"
 *   - `scrollCurrentSentenceIntoView(args)` — sentence/start anchor,
 *     upper-third target, smooth scroll gated on reduced-motion
 *
 * Public props are unchanged so the reader page keeps compiling.
 */

import * as React from "react";
import { cn } from "../cn";
import { KaraokeHighlighter, type KaraokeHighlighterProps } from "./KaraokeHighlighter";

export interface ReaderColumnProps extends Omit<KaraokeHighlighterProps, "ref"> {
  /** Ref to the scrollable container — used by the page for auto-scroll. */
  scrollRef?: React.Ref<HTMLDivElement>;
  /** Bottom padding so the fixed player doesn't cover the last line. */
  bottomPadding?: string;
}

export const ReaderColumn = React.forwardRef<HTMLDivElement, ReaderColumnProps>(function ReaderColumn(
  { scrollRef, bottomPadding = "12rem", className, ...rest },
  ref,
) {
  return (
    <div
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof scrollRef === "function") scrollRef(node);
        else if (scrollRef)
          (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn("mx-auto w-full px-4", className)}
      style={{ paddingBottom: bottomPadding }}
      data-reading="true"
    >
      <KaraokeHighlighter {...rest} />
    </div>
  );
});

// =============================================================================
// Single-scroller helpers — exported so the reader page can adopt a
// sentence-anchored, reduced-motion-gated scroll without an API break.
// =============================================================================

/**
 * Returns `true` when the user has expressed a `prefers-reduced-motion:
 * reduce` preference. SSR-safe (returns `false` server-side).
 *
 * Per audit + DESIGN-SYSTEM §10.5 + §25.9: every JS-driven motion must
 * gate on `matchMedia`. `ReaderColumn` doesn't drive motion itself,
 * but downstream scroll helpers must use this.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The scroll behavior the caller should pass to `scrollIntoView` /
 * `scrollTo`. Reduced-motion users get `auto` (instant jump); everyone
 * else gets `smooth` (animated transition).
 */
export function scrollBehavior(reducedMotion = prefersReducedMotion()): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

export interface ScrollSentenceArgs {
  /** The container the reader is rendered in (the outer scrollable page). */
  container: HTMLElement | Window | null;
  /** The index of the current sentence's word — used to derive the sentence element. */
  paragraphIndex: number;
  /** Optional override — pass an element directly to skip the lookup. */
  target?: HTMLElement | null;
  /** Optional override — when true, scroll the target into the upper third (default). */
  upperThird?: boolean;
}

/**
 * Sentence-anchored auto-scroll (DESIGN-SYSTEM §25.9): scrolls the
 * reader so the current sentence lands in the **upper third** of the
 * viewport. Honors `prefers-reduced-motion`.
 *
 * - `target` (when supplied) wins over the paragraph-index lookup.
 * - If neither yields an element, this is a no-op (avoids throwing in
 *   tests/SSR).
 * - Returns the element it scrolled, or `null` if nothing was scrolled.
 */
export function scrollCurrentSentenceIntoView({
  container,
  paragraphIndex,
  target,
  upperThird = true,
}: ScrollSentenceArgs): HTMLElement | null {
  if (typeof window === "undefined") return null;
  const reduceMotion = prefersReducedMotion();
  const behavior = scrollBehavior(reduceMotion);

  const el = target ?? document.getElementById(`paragraph-${paragraphIndex}`);
  if (!el) return null;

  // Upper-third anchor: compute the scroll offset that lands the
  // element at ~33% of the viewport. Falls back to a center scroll
  // for very small viewports.
  const viewportHeight =
    container instanceof Window ? window.innerHeight : (container as HTMLElement).clientHeight;
  const targetTop =
    el.getBoundingClientRect().top + (container instanceof Window ? window.scrollY : (container as HTMLElement).scrollTop);
  const offset = upperThird ? Math.max(0, viewportHeight / 3) : Math.max(0, viewportHeight / 2);
  const top = Math.max(0, targetTop - offset);

  if (container instanceof Window) {
    container.scrollTo({ top, behavior });
  } else {
    (container as HTMLElement).scrollTo({ top, behavior });
  }
  return el;
}