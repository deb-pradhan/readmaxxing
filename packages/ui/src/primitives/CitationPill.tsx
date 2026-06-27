"use client";

/**
 * CitationPill — the ↗¶N token for inline citations (D12).
 *
 * Per DESIGN-SYSTEM §25.8 + UI-UX-AUDIT C4, AI answers must render
 * each `[cite:p:s]` reference as a tokenized pill. This primitive is
 * the visual half — the prose half (tokenizing the markup) lives in
 * `apps/web/components/ai/ChatBubble` (Phase C) and the server-side
 * `validateCitations` already runs in `packages/ai`.
 *
 * The pill renders `↗¶{paragraphIndex}` (a sans up-arrow + a paragraph
 * glyph + the index). It is a real `<button>` (focusable, keyboard-
 * operable). When used inside a reader, the default `onClick` anchors
 * to `#paragraph-{n}`; consumers can override via the `onClick` prop.
 */

import * as React from "react";
import { cn } from "../cn";

export interface CitationPillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** The paragraph the citation references. */
  paragraphIndex: number;
  /** Optional sentence index — surfaces in `aria-label` for screen readers. */
  sentenceIndex?: number;
  /** Click handler. Defaults to scrolling to `#paragraph-{paragraphIndex}`. */
  onClick?: () => void;
  className?: string;
}

export const CitationPill = React.forwardRef<HTMLButtonElement, CitationPillProps>(
  function CitationPill(
    { paragraphIndex, sentenceIndex, onClick, className, type = "button", ...rest },
    ref,
  ) {
    const handleClick = React.useCallback(() => {
      if (onClick) {
        onClick();
        return;
      }
      if (typeof document !== "undefined") {
        const target = document.getElementById(`paragraph-${paragraphIndex}`);
        if (target) {
          const reduceMotion =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
          const previouslyFocused = document.activeElement as HTMLElement | null;
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
          target.addEventListener(
            "blur",
            () => {
              target.removeAttribute("tabindex");
              previouslyFocused?.focus();
            },
            { once: true },
          );
        }
      }
    }, [onClick, paragraphIndex]);

    const ariaLabel = sentenceIndex !== undefined
      ? `Citation: paragraph ${paragraphIndex + 1}, sentence ${sentenceIndex + 1}`
      : `Citation: paragraph ${paragraphIndex + 1}`;

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-5 items-center gap-0.5 rounded-full bg-coral-soft px-1.5 align-baseline font-mono text-[11px] font-medium text-coral-text",
          "transition-colors duration-fast ease-out hover:bg-coral-bg/20",
          "focus-visible:outline-none focus-visible:shadow-focus",
          className,
        )}
        {...rest}
      >
        <span aria-hidden className="leading-none">↗</span>
        <span aria-hidden className="leading-none">¶</span>
        <span aria-hidden className="tabular-nums leading-none">{paragraphIndex + 1}</span>
      </button>
    );
  },
);

CitationPill.displayName = "CitationPill";