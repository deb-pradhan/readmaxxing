"use client";

/**
 * ReaderColumn — the 66ch reading surface with auto-scroll.
 *
 * Per DESIGN-SYSTEM §5:
 *   - `max-width: 66ch`, centered, fluid font-size 15px, line-height 1.5.
 *   - Inter is the only font family.
 *   - Coral sentence tint + word fill for karaoke.
 */

import * as React from "react";
import { ReaderColumn as UIReaderColumn, scrollBehavior } from "@readmaxxing/ui";
import type { SegmentTree } from "@readmaxxing/core";

export interface ReaderColumnProps {
  tree: SegmentTree;
  currentWordIndex: number;
  onWordClick?: (wordIndex: number) => void;
  bionicReading?: boolean;
  focusMode?: boolean;
  /** Ref to the scrollable container (used by parent for keyboard shortcuts). */
  scrollRef?: React.Ref<HTMLDivElement>;
}

export const ReaderColumn = React.forwardRef<HTMLDivElement, ReaderColumnProps>(
  function ReaderColumn(
    { tree, currentWordIndex, onWordClick, bionicReading, focusMode, scrollRef },
    ref,
  ) {
    const internalRef = React.useRef<HTMLDivElement | null>(null);
    const lastScrolledIndex = React.useRef<string>("");

    React.useEffect(() => {
      if (typeof ref === "function") ref(internalRef.current);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = internalRef.current;
    });

    // Auto-scroll: when the current sentence changes, scroll its DOM
    // element into the upper third of the viewport.
    React.useEffect(() => {
      if (!internalRef.current) return;
      const root = internalRef.current;
      const active = root.querySelector<HTMLElement>("[data-current-sentence='true']");
      if (!active) return;
      const idx = active.getAttribute("data-sentence-key");
      if (!idx || idx === lastScrolledIndex.current) return;
      lastScrolledIndex.current = idx;
      active.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }, [currentWordIndex]);

    return (
      <div
        ref={(node) => {
          internalRef.current = node;
          if (typeof scrollRef === "function") scrollRef(node);
          else if (scrollRef)
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="mx-auto w-full px-4"
        style={{ paddingBottom: "12rem" }}
      >
        <UIReaderColumn
          tree={tree}
          currentWordIndex={currentWordIndex}
          onWordClick={onWordClick}
          bionicReading={bionicReading}
          focusMode={focusMode}
          bottomPadding="2rem"
        />
      </div>
    );
  },
);