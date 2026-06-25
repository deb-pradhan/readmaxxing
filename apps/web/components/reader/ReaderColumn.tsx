/**
 * ReaderColumn — Phase 2 stub.
 *
 * Per UI-UX.md §5 ("The Reader Surface"): a vertically-centered 66ch
 * column that holds the doc's paragraphs/sentences/words with the
 * `KaraokeHighlighter` advancing the active word from the speech marks.
 *
 * Features that Phase 2 wires into this component:
 *   - Opt-in Bionic Reading (fixation letters).
 *   - Auto-scroll keeping the current sentence in the upper third.
 *   - Focus mode (F key) dims non-current paragraphs.
 *   - One-tap theme switch (Light / Dark / Sepia / E-ink).
 *   - Reading ruler / line guide option.
 *   - Click-any-word → seek audio there and re-sync highlighting.
 *
 * Component contract intentionally returns `null` in Phase 1 so the page
 * compiles without dragging in the full reader surface.
 */

export interface ReaderColumnProps {
  documentId: string;
  /** Resume from this paragraph/sentence/word triple, or null for "from the top". */
  resumeFrom?: { paragraphIndex: number; sentenceIndex: number; wordIndex: number } | null;
}

export function ReaderColumn(_props: ReaderColumnProps): React.JSX.Element | null {
  // TODO(phase-2): render the SegmentTree paragraphs with karaoke highlighting
  // bound to the Player's current word.
  return null;
}