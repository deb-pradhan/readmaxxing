/**
 * Speech marks — canonical type definitions + utilities.
 *
 * This module is a re-export of the singular `speech-mark.ts` plus a
 * heuristic word-timestamp generator. Per UI-UX.md §4.8, highlight
 * transitions advance at 120ms; never strobe.
 *
 * The heuristic is a Phase 1 simplification — splits text on word boundaries
 * and assigns each word a duration of `60000 / WPM` ms, then nudges the
 * boundaries so they stay aligned with sentence pauses. Phase 2 swaps this
 * out for real word-level timestamps returned by ElevenLabs' `with_timestamps`
 * call.
 */

export type { SpeechMark, SpeechMarkType } from "./speech-mark";
export { buildSpeechMarks, findWordAtTime } from "./speech-mark";

import type { SpeechMark } from "./speech-mark";

/** Default WPM used by the heuristic. Matches ElevenLabs' default voice speed. */
export const HEURISTIC_WPM = 155;

interface MarkWord {
  /** Inclusive offset into the source text (chars). */
  start: number;
  /** Exclusive end offset. */
  end: number;
}

interface MarkSentence {
  start: number;
  end: number;
}

/**
 * Generate heuristic word + sentence marks for a given text.
 *
 * @param text  The full text that will be sent to TTS.
 * @param words List of `[start, end)` word ranges (already tokenized).
 * @param sentences List of `[start, end)` sentence ranges.
 * @param wpm Speaking rate in words per minute.
 * @param options.speed Playback speed (multiplier on the heuristic duration).
 *
 * The implementation is intentionally simple — each word gets
 * `60000/wpm/speed` ms. Sentence marks take the start time of their first
 * word. This is good enough for Phase 1 and lets us swap in real timestamps
 * by replacing this function (the call sites in `apps/web/lib/tts/client.ts`
 * and `apps/web/app/api/tts/route.ts` consume the same `SpeechMark[]` shape).
 */
export function heuristicSpeechMarks(
  text: string,
  words: MarkWord[],
  sentences: MarkSentence[],
  wpm: number = HEURISTIC_WPM,
  options: { speed?: number; paddingMs?: number } = {},
): SpeechMark[] {
  const speed = options.speed && options.speed > 0 ? options.speed : 1;
  const paddingMs = options.paddingMs ?? 0;
  const perWordMs = 60_000 / wpm / speed;

  const marks: SpeechMark[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    marks.push({
      type: "word",
      start: w.start,
      end: w.end,
      timeSeconds: (i * perWordMs + paddingMs) / 1000,
      text: text.slice(w.start, w.end),
    });
  }
  for (const s of sentences) {
    const first = marks.find(
      (m) => m.type === "word" && m.start >= s.start && m.end <= s.end,
    );
    if (!first) continue;
    marks.push({
      type: "sentence",
      start: s.start,
      end: s.end,
      timeSeconds: first.timeSeconds,
      text: text.slice(s.start, s.end),
    });
  }
  marks.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return marks;
}