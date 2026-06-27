/**
 * KaraokeSync tests — emit ordering, change detection, and drift reporting.
 *
 * The sync layer sits between the audio engine (which knows `currentTime`)
 * and the UI (which needs `currentWord` + `currentSentence`). It must:
 *   - Emit `word` only when the active word index actually changes.
 *   - Emit `sentence` only when the active sentence index actually changes.
 *   - Emit `drift` when visual time trails audio time by > threshold.
 */

import { describe, it, expect, vi } from "vitest";
import type { SpeechMark } from "@readmaxxing/tts";
import { KaraokeSync } from "./karaoke-sync";

const marks: SpeechMark[] = [
  { type: "word", start: 0, end: 5, timeSeconds: 0.0, text: "Hello" },
  { type: "word", start: 6, end: 11, timeSeconds: 0.5, text: "world" },
  { type: "word", start: 13, end: 17, timeSeconds: 1.0, text: "again" },
  { type: "sentence", start: 0, end: 12, timeSeconds: 0.0, text: "Hello world." },
  { type: "sentence", start: 13, end: 18, timeSeconds: 1.0, text: "Again." },
];

describe("KaraokeSync", () => {
  it("emits word + sentence on first tick", () => {
    const sync = new KaraokeSync({ marks });
    const wordHandler = vi.fn();
    const sentenceHandler = vi.fn();
    sync.on("word", wordHandler);
    sync.on("sentence", sentenceHandler);

    sync.tick(0.0);

    expect(wordHandler).toHaveBeenCalledTimes(1);
    expect(wordHandler.mock.calls[0]?.[0]?.word?.text).toBe("Hello");
    expect(sentenceHandler).toHaveBeenCalledTimes(1);
    expect(sentenceHandler.mock.calls[0]?.[0]?.sentence?.text).toBe("Hello world.");
  });

  it("does not re-emit when active word stays the same", () => {
    const sync = new KaraokeSync({ marks });
    const wordHandler = vi.fn();
    sync.on("word", wordHandler);

    sync.tick(0.0);
    sync.tick(0.1);
    sync.tick(0.2);

    expect(wordHandler).toHaveBeenCalledTimes(1);
  });

  it("emits a new word when active word changes", () => {
    const sync = new KaraokeSync({ marks });
    const fired: string[] = [];
    sync.on("word", (p) => {
      if (p.word) fired.push(p.word.text);
    });

    sync.tick(0.0);
    sync.tick(0.5);
    sync.tick(1.0);

    expect(fired).toEqual(["Hello", "world", "again"]);
  });

  it("emits a new sentence when active sentence changes", () => {
    const sync = new KaraokeSync({ marks });
    const fired: string[] = [];
    sync.on("sentence", (p) => {
      if (p.sentence) fired.push(p.sentence.text);
    });

    sync.tick(0.0);
    sync.tick(1.0);

    expect(fired).toEqual(["Hello world.", "Again."]);
  });

  it("emits drift when visual time trails audio time beyond threshold", () => {
    const sync = new KaraokeSync({ marks, driftThresholdMs: 100 });
    const driftHandler = vi.fn();
    sync.on("drift", driftHandler);

    // Audio at 0.5s, visual at 0.0s → drift = audio - visual = 500ms > 100ms threshold
    sync.tick(0.5, 0.0);

    expect(driftHandler).toHaveBeenCalledTimes(1);
    expect(driftHandler.mock.calls[0]?.[0]?.driftMs).toBeCloseTo(500, 0);
  });

  it("does NOT emit drift when visual is within threshold", () => {
    const sync = new KaraokeSync({ marks, driftThresholdMs: 100 });
    const driftHandler = vi.fn();
    sync.on("drift", driftHandler);

    sync.tick(0.5, 0.5); // identical, no drift

    expect(driftHandler).not.toHaveBeenCalled();
  });

  it("emits null word when audio is before first mark (after having one)", () => {
    const sync = new KaraokeSync({ marks });
    const wordHandler = vi.fn();
    sync.on("word", wordHandler);

    // 1. Tick at a time where a word exists.
    sync.tick(0.0);
    // 2. Reset to marks that begin later.
    sync.setMarks([
      { type: "word", start: 100, end: 105, timeSeconds: 1.0, text: "Late" },
    ]);
    // 3. Tick before any word is active — should emit null because previous word was active.
    sync.tick(0.5);

    // First emit (word "Hello"), second emit (null from setMarks), then the tick at 0.5
    // before any word is active should NOT fire another event (state unchanged).
    expect(wordHandler).toHaveBeenCalledTimes(2);
    expect(wordHandler.mock.calls[0]?.[0]?.word?.text).toBe("Hello");
    expect(wordHandler.mock.calls[1]?.[0]?.word).toBeNull();
  });

  it("setMarks resets state", () => {
    const sync = new KaraokeSync({ marks });
    const wordHandler = vi.fn();
    sync.on("word", wordHandler);

    sync.tick(0.0);
    sync.setMarks([
      { type: "word", start: 0, end: 2, timeSeconds: 0.0, text: "Hi" },
    ]);
    sync.tick(0.0);

    // 1st emit: word "Hello" from initial marks
    // 2nd emit: null from setMarks reset
    // 3rd emit: word "Hi" from new marks
    expect(wordHandler.mock.calls.length).toBe(3);
    expect(wordHandler.mock.calls[0]?.[0]?.word?.text).toBe("Hello");
    expect(wordHandler.mock.calls[1]?.[0]?.word).toBeNull();
    expect(wordHandler.mock.calls[2]?.[0]?.word?.text).toBe("Hi");
  });
});