"use client";

/**
 * KaraokeHighlighter — thin wrapper that wires `@readmaxxing/ui`'s primitive
 * to the player state. The primitive is fully reusable across web/extension/
 * mobile; this wrapper bakes in the segment-tree + current-word-index prop
 * shape used by the reader page.
 */

import { KaraokeHighlighter as UIKaraokeHighlighter } from "@readmaxxing/ui";
import type { SegmentTree } from "@readmaxxing/core";

export interface KaraokeHighlighterProps {
  tree: SegmentTree;
  currentWordIndex: number;
  onWordClick?: (wordIndex: number) => void;
  bionicReading?: boolean;
  focusMode?: boolean;
}

export function KaraokeHighlighter({
  tree,
  currentWordIndex,
  onWordClick,
  bionicReading,
  focusMode,
}: KaraokeHighlighterProps) {
  return (
    <UIKaraokeHighlighter
      tree={tree}
      currentWordIndex={currentWordIndex}
      onWordClick={onWordClick}
      bionicReading={bionicReading}
      focusMode={focusMode}
    />
  );
}