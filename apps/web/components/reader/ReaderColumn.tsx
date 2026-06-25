"use client";

/**
 * ReaderColumn — reader page wrapper around `@readmaxxing/ui`'s ReaderColumn.
 *
 * Adds the bottom padding needed to clear the fixed Player and exposes a
 * scroll callback so the page can implement auto-scroll (Phase 2).
 */

import * as React from "react";
import { ReaderColumn as UIReaderColumn } from "@readmaxxing/ui";
import type { SegmentTree } from "@readmaxxing/core";

export interface ReaderColumnProps {
  tree: SegmentTree;
  currentWordIndex: number;
  onWordClick?: (wordIndex: number) => void;
  bionicReading?: boolean;
  focusMode?: boolean;
}

export function ReaderColumn({
  tree,
  currentWordIndex,
  onWordClick,
  bionicReading,
  focusMode,
}: ReaderColumnProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <UIReaderColumn
      tree={tree}
      currentWordIndex={currentWordIndex}
      onWordClick={onWordClick}
      bionicReading={bionicReading}
      focusMode={focusMode}
      scrollRef={scrollRef}
      bottomPadding="8rem"
    />
  );
}