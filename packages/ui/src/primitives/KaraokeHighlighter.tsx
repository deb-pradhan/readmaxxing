"use client";

/**
 * KaraokeHighlighter — sentence tint + word fill, advanced by `currentWordIndex`.
 *
 * Per UI-UX.md §3.1 + §4.8:
 * - Two-level emphasis: current sentence gets a soft tint background,
 *   current word gets a stronger accent fill. Two levels lock the eye
 *   without strobing the page.
 * - Highlight transitions advance at 120ms (motion-highlight token).
 * - `prefers-reduced-motion` collapses the transition to instant.
 * - Click any word to jump — `onWordClick(index)` bubbles up.
 * - Sentence change is announced via a polite live region for screen readers
 *   (UI-UX.md §9).
 *
 * Pure presentation: the parent owns the index. The component just renders.
 */

import * as React from "react";
import { cn } from "../cn";
import type { SegmentTree, Word } from "@readmaxxing/core";

export interface KaraokeHighlighterProps {
  /** The document tree to render. */
  tree: SegmentTree;
  /** Index of the active word in the *flat* word list, or -1 for none. */
  currentWordIndex: number;
  /** Click handler — fired with the index of the clicked word. */
  onWordClick?: (wordIndex: number) => void;
  /** Optional opt-in bionic fixation (UI-UX.md §5). */
  bionicReading?: boolean;
  /** Optional focus-mode dimming for non-current paragraphs (UI-UX.md §5). */
  focusMode?: boolean;
  /** Extra className on the outer container. */
  className?: string;
}

interface FlatWord {
  globalIndex: number;
  /** Compound key: `${paragraphIndex}::${sentenceIndex}`. */
  sentenceKey: string;
  paragraphIndex: number;
  word: Word;
}

function flatten(tree: SegmentTree): FlatWord[] {
  const flat: FlatWord[] = [];
  for (const paragraph of tree.paragraphs) {
    for (const sentence of paragraph.sentences) {
      for (const word of sentence.words) {
        flat.push({
          globalIndex: flat.length,
          sentenceKey: `${paragraph.index}::${sentence.index}`,
          paragraphIndex: paragraph.index,
          word,
        });
      }
    }
  }
  return flat;
}

/**
 * Bionic Reading — bold the first 40% of letters (default) of each word so
 * the eye can latch onto the word without saccading. Opt-in per UI-UX.md §5.
 */
function bionicSplit(word: string, fixation = 0.4): { lead: string; rest: string } {
  if (word.length <= 1) return { lead: word, rest: "" };
  const cut = Math.max(1, Math.ceil(word.length * fixation));
  return { lead: word.slice(0, cut), rest: word.slice(cut) };
}

export const KaraokeHighlighter = React.forwardRef<HTMLDivElement, KaraokeHighlighterProps>(
  function KaraokeHighlighter(
    { tree, currentWordIndex, onWordClick, bionicReading = false, focusMode = false, className },
    ref,
  ) {
    const flat = React.useMemo(() => flatten(tree), [tree]);
    const currentFlat = currentWordIndex >= 0 ? flat[currentWordIndex] : null;
    const currentSentenceKey = currentFlat?.sentenceKey ?? "";
    const currentParagraphIndex = currentFlat?.paragraphIndex ?? -1;

    const currentSentenceText = React.useMemo(() => {
      if (!currentFlat) return "";
      for (const paragraph of tree.paragraphs) {
        for (const sentence of paragraph.sentences) {
          if (
            paragraph.index === currentParagraphIndex &&
            `${paragraph.index}::${sentence.index}` === currentSentenceKey
          ) {
            return sentence.text;
          }
        }
      }
      return "";
    }, [currentFlat, currentParagraphIndex, currentSentenceKey, tree]);

    return (
      <div ref={ref} className={cn("reading-column mx-auto", className)}>
        {/* Polite live region — UI-UX.md §9: announce current sentence. */}
        <div className="rmx-live" aria-live="polite" aria-atomic="true">
          {currentSentenceText}
        </div>

        {tree.paragraphs.map((paragraph) => {
          const dim = focusMode && paragraph.index !== currentParagraphIndex;
          return (
            <p
              key={paragraph.index}
              className={cn(
                "mb-7 text-body leading-relaxed",
                dim && "opacity-30 transition-opacity",
              )}
              data-paragraph-index={paragraph.index}
            >
              {paragraph.sentences.map((sentence) => {
                const sentenceIsActive =
                  `${paragraph.index}::${sentence.index}` === currentSentenceKey;
                return (
                  <span
                    key={sentence.index}
                    className={cn(
                      "rounded-sm transition-colors duration-highlight ease-out",
                      sentenceIsActive && "bg-accent-soft",
                    )}
                    data-sentence-index={sentence.index}
                  >
                    {sentence.words.map((word) => {
                      const globalIdx = flat.find(
                        (f) => f.word.start === word.start && f.word.end === word.end,
                      )?.globalIndex;
                      const active = globalIdx === currentWordIndex;
                      return (
                        <span
                          key={`${word.start}-${word.end}`}
                          role="button"
                          tabIndex={0}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "cursor-pointer rounded-sm transition-colors duration-highlight ease-out",
                            active && "bg-accent-strong text-ink-inverse",
                          )}
                          onClick={() => {
                            if (typeof globalIdx === "number" && onWordClick) onWordClick(globalIdx);
                          }}
                          onKeyDown={(e) => {
                            if (
                              (e.key === "Enter" || e.key === " ") &&
                              typeof globalIdx === "number"
                            ) {
                              e.preventDefault();
                              onWordClick?.(globalIdx);
                            }
                          }}
                        >
                          {bionicReading ? <BionicWord word={word.text} /> : word.text}
                          {/* Preserve the source spacing exactly. */}
                          {word.end < sentence.end && textBetween(sentence.text, word, sentence.words)}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    );
  },
);

function textBetween(
  sentenceText: string,
  word: Word,
  words: ReadonlyArray<Word>,
): React.ReactNode {
  const idx = words.findIndex((w) => w.start === word.start && w.end === word.end);
  const next = words[idx + 1];
  if (!next) return "";
  return sentenceText.slice(word.end, next.start);
}

const BionicWord = React.memo(function BionicWord({ word }: { word: string }) {
  const { lead, rest } = bionicSplit(word);
  return (
    <>
      <strong className="font-bold">{lead}</strong>
      <span>{rest}</span>
    </>
  );
});