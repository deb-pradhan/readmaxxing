/**
 * Speech marks — timestamps returned alongside TTS audio chunks so the
 * karaoke highlighter can advance exactly to the right word/sentence.
 *
 * Per UI-UX.md §4.8: highlight transitions 120ms advance; never strobe.
 * Word-level marks are the source of truth for resume-to-exact-word
 * (UI-UX.md §4.3).
 */

export type SpeechMarkType = "word" | "sentence" | "ssml";

export interface SpeechMark {
  /** Position into the input text (character offset). */
  start: number;
  /** Inclusive end offset. */
  end: number;
  /** Time in seconds from the start of the chunk. */
  timeSeconds: number;
  /** Type of mark. */
  type: SpeechMarkType;
  /** The text this mark aligns to. */
  text: string;
}

/** Build a flat list of speech marks from a text + per-word timing list. */
export function buildSpeechMarks(
  text: string,
  words: Array<{ start: number; end: number; timeSeconds: number }>,
  sentenceBoundaries: Array<{ start: number; end: number }>,
): SpeechMark[] {
  const marks: SpeechMark[] = [];
  // Word marks.
  for (const w of words) {
    marks.push({
      start: w.start,
      end: w.end,
      timeSeconds: w.timeSeconds,
      type: "word",
      text: text.slice(w.start, w.end),
    });
  }
  // Sentence marks — pick the timeSeconds of the first word inside.
  for (const s of sentenceBoundaries) {
    const firstWord = words.find(
      (w) => w.start >= s.start && w.end <= s.end,
    );
    if (!firstWord) continue;
    marks.push({
      start: s.start,
      end: s.end,
      timeSeconds: firstWord.timeSeconds,
      type: "sentence",
      text: text.slice(s.start, s.end),
    });
  }
  marks.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return marks;
}

/** Locate the word whose interval contains `timeSeconds`. */
export function findWordAtTime(
  marks: SpeechMark[],
  timeSeconds: number,
): SpeechMark | null {
  // Binary search over word marks only.
  let lo = 0;
  let hi = marks.length - 1;
  let last: SpeechMark | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = marks[mid]!;
    if (m.type !== "word") {
      // Skip non-word marks by sliding.
      if (m.timeSeconds <= timeSeconds) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
      continue;
    }
    if (m.timeSeconds <= timeSeconds) {
      last = m;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return last;
}