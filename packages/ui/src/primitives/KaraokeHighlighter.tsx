"use client";

/**
 * KaraokeHighlighter — sentence tint + word fill, advanced by
 * `currentWordIndex`.
 *
 * Per DESIGN-SYSTEM §3 (color tokens), §4 (type), §5 (icons):
 * - Two-level emphasis: current sentence gets a soft coral tint
 *   background, current word gets a stronger coral fill. Two levels
 *   lock the eye without strobing the page.
 * - Highlight transitions advance at 120ms (motion-highlight token).
 * - `prefers-reduced-motion` collapses the transition to instant.
 * - Click any word to jump — `onWordClick(index)` bubbles up.
 * - Sentence change is announced via a polite live region for screen
 *   readers (DESIGN-SYSTEM §19.3).
 * - Each word renders `<span data-word-idx={i}>`, each sentence
 *   `<span data-sentence-key data-current-sentence>`, and the active
 *   word `<span data-current-word>` so the page can wire click-to-jump,
 *   auto-scroll, and CSS hooks directly.
 *
 * Inter is the only type family — no serif. Body 15px, line-height 1.5.
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
  /** Optional opt-in bionic fixation. */
  bionicReading?: boolean;
  /** Optional focus-mode dimming for non-current paragraphs. */
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
 * Bionic Reading — bold the first 40% of letters (default) of each
 * word so the eye can latch onto the word without saccading. Opt-in.
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
        {/* Polite live region — DESIGN-SYSTEM §19.3: announce current
            sentence for BR + screen-reader users. */}
        <div className="rmx-live" aria-live="polite" aria-atomic="true">
          {currentSentenceText}
        </div>

        {tree.paragraphs.map((paragraph) => {
          const dim =
            focusMode &&
            currentParagraphIndex >= 0 &&
            paragraph.index !== currentParagraphIndex;
          const level = paragraph.headingLevel ?? 0;
          const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "p") as
            | "h1"
            | "h2"
            | "h3"
            | "p";
          const blockClass =
            level === 1
              ? "mt-10 mb-4 text-2xl font-bold leading-tight tracking-tight first:mt-0 sm:text-3xl"
              : level === 2
                ? "mt-10 mb-3 text-xl font-bold leading-snug tracking-tight first:mt-0 sm:text-2xl"
                : level >= 3
                  ? "mt-8 mb-2 text-lg font-semibold leading-snug tracking-tight first:mt-0"
                  : "mb-5 text-[1.0625rem] leading-[1.85] text-ink";
          return (
            <Tag
              key={paragraph.index}
              className={cn(
                blockClass,
                dim && "opacity-30 transition-opacity",
              )}
              data-paragraph-index={paragraph.index}
            >
              {paragraph.sentences.map((sentence) => {
                const sentenceIsActive =
                  `${paragraph.index}::${sentence.index}` === currentSentenceKey;
                // Whitespace AFTER this sentence's last word, up to the
                // sentence boundary. The inter-sentence space lives inside this
                // sentence's range (after the final word), so without rendering
                // it adjacent sentences run together ("word.Paste an article").
                const lastWord = sentence.words[sentence.words.length - 1];
                const trailingGap = lastWord
                  ? paragraph.text.slice(
                      lastWord.end - paragraph.start,
                      sentence.end - paragraph.start,
                    )
                  : "";
                // Punctuation before the first word (e.g. an opening quote or
                // paren) — words start *after* leading punctuation, so render it.
                const firstWord = sentence.words[0];
                const leadingGap = firstWord
                  ? sentence.text.slice(0, firstWord.start - sentence.start)
                  : "";
                return (
                  <React.Fragment key={sentence.index}>
                  <span
                    className={cn(
                      "rounded-md transition-colors duration-highlight ease-out",
                      sentenceIsActive && "bg-coral-soft/40",
                    )}
                    data-sentence-index={sentence.index}
                    data-sentence-key={`${paragraph.index}::${sentence.index}`}
                    data-current-sentence={sentenceIsActive ? "true" : "false"}
                  >
                    {leadingGap}
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
                          data-word-idx={globalIdx}
                          data-current-word={active ? "true" : "false"}
                          className={cn(
                            "cursor-pointer rounded-[5px] transition-colors duration-highlight ease-out",
                            "focus-visible:outline-none focus-visible:shadow-focus",
                            // Soft tint highlight with breathing room but no
                            // layout shift (padding offset by negative margin;
                            // box-decoration-break keeps it tidy across wraps).
                            active &&
                              "-mx-0.5 bg-coral-bg/20 px-0.5 font-semibold text-coral-text [-webkit-box-decoration-break:clone] [box-decoration-break:clone]",
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
                          {word.end < sentence.end &&
                            textBetween(sentence.text, sentence.start, word, sentence.words)}
                        </span>
                      );
                    })}
                  </span>
                  {trailingGap}
                  </React.Fragment>
                );
              })}
            </Tag>
          );
        })}
      </div>
    );
  },
);

function textBetween(
  sentenceText: string,
  sentenceStart: number,
  word: Word,
  words: ReadonlyArray<Word>,
): React.ReactNode {
  const idx = words.findIndex((w) => w.start === word.start && w.end === word.end);
  const next = words[idx + 1];
  if (!next) return "";
  // word/next offsets are global (into the whole document); sentenceText is a
  // local substring, so rebase the slice by the sentence's start offset.
  return sentenceText.slice(word.end - sentenceStart, next.start - sentenceStart);
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