"use client";

/**
 * ReaderColumn — the vertically-centered 66ch reading surface (UI-UX.md §5).
 *
 * Thin wrapper around `KaraokeHighlighter`. Reserved here for future
 * scroll-into-view, auto-scroll-keep-current-sentence-in-upper-third,
 * focus-mode, and line-guide logic.
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