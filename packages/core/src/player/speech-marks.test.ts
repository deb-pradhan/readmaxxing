/**
 * Speech-marks binary search tests.
 *
 * Critical because the audio engine's `requestAnimationFrame` loop calls
 * `getCurrentWordMark` / `getCurrentSentenceMark` every frame. Correctness
 * here is the difference between karaoke that feels telepathic and one that
 * feels laggy.
 */

import { describe, it, expect } from "vitest";
import type { SpeechMark } from "@readmaxxing/tts";
import {
  getCurrentWordMark,
  getCurrentSentenceMark,
  partitionMarks,
  wordMarksSorted,
} from "./speech-marks";

const marks: SpeechMark[] = [
  { type: "word", start: 0, end: 5, timeSeconds: 0.0, text: "Hello" },
  { type: "word", start: 6, end: 11, timeSeconds: 0.4, text: "world" },
  { type: "sentence", start: 0, end: 12, timeSeconds: 0.0, text: "Hello world." },
  { type: "word", start: 13, end: 17, timeSeconds: 0.8, text: "This" },
  { type: "word", start: 18, end: 22, timeSeconds: 1.0, text: "test" },
  { type: "word", start: 23, end: 27, timeSeconds: 1.2, text: "runs" },
  { type: "word", start: 28, end: 33, timeSeconds: 1.4, text: "fast" },
  { type: "sentence", start: 13, end: 34, timeSeconds: 0.8, text: "This test runs fast." },
];

describe("getCurrentWordMark", () => {
  it("returns null for empty marks", () => {
    expect(getCurrentWordMark([], 0.5)).toBeNull();
  });

  it("returns null for time before first mark", () => {
    expect(getCurrentWordMark(marks, -1)).toBeNull();
  });

  it("returns the last word for time after last mark", () => {
    // Past-end-of-audio: the binary search returns the last word mark
    // because `timeSeconds <= t` is still true. Callers should check
    // `currentTime >= duration` before treating it as 'current'.
    expect(getCurrentWordMark(marks, 999)?.text).toBe("fast");
  });

  it("returns the first word at t=0", () => {
    const w = getCurrentWordMark(marks, 0);
    expect(w?.text).toBe("Hello");
  });

  it("returns the matching word at its timestamp", () => {
    const w = getCurrentWordMark(marks, 1.0);
    expect(w?.text).toBe("test");
  });

  it("returns the most-recent word for t between marks", () => {
    const w = getCurrentWordMark(marks, 1.1);
    expect(w?.text).toBe("test");
  });

  it("returns null for non-finite time", () => {
    expect(getCurrentWordMark(marks, Number.NaN)).toBeNull();
    expect(getCurrentWordMark(marks, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("uses binary search (correctness on large arrays)", () => {
    const big: SpeechMark[] = Array.from({ length: 1000 }, (_, i) => ({
      type: "word",
      start: i,
      end: i + 1,
      timeSeconds: i * 0.1,
      text: `w${i}`,
    }));
    expect(getCurrentWordMark(big, 50.05)?.text).toBe("w500");
    expect(getCurrentWordMark(big, 0)?.text).toBe("w0");
    expect(getCurrentWordMark(big, 99.999)?.text).toBe("w999");
  });
});

describe("getCurrentSentenceMark", () => {
  it("returns the first sentence at t=0", () => {
    const s = getCurrentSentenceMark(marks, 0);
    expect(s?.text).toBe("Hello world.");
  });

  it("returns the second sentence at t=0.9", () => {
    const s = getCurrentSentenceMark(marks, 0.9);
    expect(s?.text).toBe("This test runs fast.");
  });

  it("returns null for time before first sentence", () => {
    expect(getCurrentSentenceMark([], 0.5)).toBeNull();
  });

  it("returns null for non-finite time", () => {
    expect(getCurrentSentenceMark(marks, Number.NaN)).toBeNull();
  });
});

describe("partitionMarks / wordMarksSorted", () => {
  it("partitions marks into word + sentence arrays", () => {
    const { words, sentences } = partitionMarks(marks);
    expect(words).toHaveLength(6);
    expect(sentences).toHaveLength(2);
    expect(words.every((w) => w.type === "word")).toBe(true);
    expect(sentences.every((s) => s.type === "sentence")).toBe(true);
  });

  it("wordMarksSorted returns time-sorted word marks", () => {
    const sorted = wordMarksSorted(marks);
    expect(sorted.map((m) => m.timeSeconds)).toEqual([0, 0.4, 0.8, 1.0, 1.2, 1.4]);
  });
});