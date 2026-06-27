/**
 * Speech marks binary search — locate the active word/sentence mark for a
 * given audio timestamp. Mirrors the contract from `packages/tts` so the
 * player doesn't care which provider generated the marks.
 *
 * Per UI-UX.md §4.8: highlight transitions advance at 120ms; never strobe.
 * Word-level marks drive karaoke; sentence marks drive the soft tint behind
 * the active word.
 *
 * All functions are pure and binary-search efficient so the audio engine's
 * `requestAnimationFrame` loop can call them every frame without jank.
 */

import type { SentenceMark, WordMark } from "./types";
import type { SpeechMark } from "@readmaxxing/tts";

/**
 * Find the word mark whose interval contains `timeSeconds`.
 *
 * Returns `null` for empty marks, time before the first mark, or time after
 * the last mark — the caller treats that as "no current word".
 *
 * Uses a binary search over word marks only (sentence marks are skipped).
 */
export function getCurrentWordMark(
  marks: ReadonlyArray<SpeechMark>,
  timeSeconds: number,
): WordMark | null {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return null;
  if (marks.length === 0) return null;

  // Filter to word marks; binary search on indices within that array.
  const indices: number[] = [];
  for (let i = 0; i < marks.length; i++) if (marks[i]!.type === "word") indices.push(i);

  if (indices.length === 0) return null;

  let lo = 0;
  let hi = indices.length - 1;
  let lastIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const mIdx = indices[mid]!;
    const m = marks[mIdx]!;
    if (m.timeSeconds <= timeSeconds) {
      lastIdx = mIdx;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (lastIdx < 0) return null;
  const m = marks[lastIdx]!;
  return {
    type: "word",
    start: m.start,
    end: m.end,
    timeSeconds: m.timeSeconds,
    text: m.text,
  };
}

/**
 * Find the sentence mark whose interval contains `timeSeconds`.
 *
 * Sentence marks anchor the soft tint behind the active word. A `null` return
 * means no sentence has been reached yet (audio before the first sentence).
 */
export function getCurrentSentenceMark(
  marks: ReadonlyArray<SpeechMark>,
  timeSeconds: number,
): SentenceMark | null {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return null;
  if (marks.length === 0) return null;

  // Sentence marks are sparse; linear scan is fine because we expect ≤ 1 per
  // sentence and sentences are typically dozens of words apart.
  let latest: SentenceMark | null = null;
  for (const m of marks) {
    if (m.type !== "sentence") continue;
    if (m.timeSeconds <= timeSeconds) {
      latest = {
        type: "sentence",
        start: m.start,
        end: m.end,
        timeSeconds: m.timeSeconds,
        text: m.text,
      };
    } else {
      break;
    }
  }
  return latest;
}

/**
 * Flatten `marks` into separate word + sentence arrays. Useful for callers
 * that want to feed both into a sub-component without re-filtering.
 */
export function partitionMarks(marks: ReadonlyArray<SpeechMark>): {
  words: WordMark[];
  sentences: SentenceMark[];
} {
  const words: WordMark[] = [];
  const sentences: SentenceMark[] = [];
  for (const m of marks) {
    if (m.type === "word") {
      words.push({
        type: "word",
        start: m.start,
        end: m.end,
        timeSeconds: m.timeSeconds,
        text: m.text,
      });
    } else if (m.type === "sentence") {
      sentences.push({
        type: "sentence",
        start: m.start,
        end: m.end,
        timeSeconds: m.timeSeconds,
        text: m.text,
      });
    }
  }
  return { words, sentences };
}

/**
 * Pre-filter marks into word-only, sorted by `timeSeconds`. The audio engine
 * caches this once per chunk so its per-frame binary search is small.
 */
export function wordMarksSorted(marks: ReadonlyArray<SpeechMark>): WordMark[] {
  const out: WordMark[] = [];
  for (const m of marks) {
    if (m.type !== "word") continue;
    out.push({
      type: "word",
      start: m.start,
      end: m.end,
      timeSeconds: m.timeSeconds,
      text: m.text,
    });
  }
  out.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return out;
}