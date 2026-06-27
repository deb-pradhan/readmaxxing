/**
 * KaraokeSync — combine audio-engine `time` events with the speech-marks
 * binary search to emit `word`, `sentence`, and `drift` events.
 *
 * Per UI-UX.md §4.8: highlight transitions advance at 120ms; never strobe.
 * The sync layer owns the current word + sentence indices and only fires a
 * new event when they actually change (not on every RAF tick).
 *
 * Drift detection: the `audio.currentTime` (audio-engine) is the source of
 * truth. When the *visual* time (driven by the same engine) trails the audio
 * by >150ms, we emit `drift` so the UI can re-sync the karaoke highlight.
 * In the v2 layout the audio engine emits time directly; the consumer can
 * also pass an explicit `visualTime` when the visual playback is governed by
 * a different source (e.g. animation frames).
 */

import type { SpeechMark } from "@readmaxxing/tts";
import { getCurrentWordMark, getCurrentSentenceMark } from "./speech-marks";
import type {
  PlayerControls,
  PlayerEventMap,
  PlayerEventName,
  PlayerListener,
  WordMark,
  SentenceMark,
} from "./types";

export interface KaraokeSyncOptions {
  /** Speech marks for the current audio chunk. */
  marks: ReadonlyArray<SpeechMark>;
  /** Drift threshold in ms. Default 150. */
  driftThresholdMs?: number;
}

export class KaraokeSync implements PlayerControls {
  private readonly listeners = new Map<PlayerEventName, Set<(p: unknown) => void>>();
  private currentWordIndex = -1;
  private currentSentenceIndex = -1;
  private currentWord: WordMark | null = null;
  private currentSentence: SentenceMark | null = null;
  private lastAudioTimeMs = 0;
  private lastVisualTimeMs = 0;
  private readonly driftThresholdMs: number;
  private marks: ReadonlyArray<SpeechMark>;

  constructor(opts: KaraokeSyncOptions) {
    this.marks = opts.marks;
    this.driftThresholdMs = opts.driftThresholdMs ?? 150;
  }

  /** Replace the speech marks (e.g. when a new chunk arrives). */
  setMarks(marks: ReadonlyArray<SpeechMark>): void {
    this.marks = marks;
    // Reset state — the audio engine will trigger a fresh `time` event.
    this.currentWordIndex = -1;
    this.currentSentenceIndex = -1;
    this.currentWord = null;
    this.currentSentence = null;
    // Notify subscribers that the active indices have been cleared.
    this.emit("word", { word: null, index: -1 });
    this.emit("sentence", { sentence: null, index: -1 });
  }

  /**
   * Tick called by the consumer on every audio time update. Updates
   * `currentWord` / `currentSentence` and emits change events.
   *
   * @param audioTimeSeconds  Source-of-truth time from the audio engine.
   * @param visualTimeSeconds Optional explicit visual time; defaults to the
   *                          audio time when omitted.
   */
  tick(audioTimeSeconds: number, visualTimeSeconds?: number): void {
    const audioMs = audioTimeSeconds * 1000;
    const visualMs = (visualTimeSeconds ?? audioTimeSeconds) * 1000;
    this.lastAudioTimeMs = audioMs;
    this.lastVisualTimeMs = visualMs;

    const driftMs = audioMs - visualMs;
    if (driftMs > this.driftThresholdMs) {
      this.emit("drift", { driftMs, currentTime: audioTimeSeconds });
    }

    // Word mark — binary search via the helper.
    const word = getCurrentWordMark(this.marks, audioTimeSeconds);
    if (word) {
      const idx = this.marks.findIndex(
        (m) => m.type === "word" && m.start === word.start && m.end === word.end,
      );
      if (idx !== this.currentWordIndex) {
        this.currentWordIndex = idx;
        this.currentWord = word;
        this.emit("word", { word, index: idx });
      }
    } else if (this.currentWordIndex !== -1) {
      this.currentWordIndex = -1;
      this.currentWord = null;
      this.emit("word", { word: null, index: -1 });
    }

    // Sentence mark — linear scan (cheap, sparse).
    const sentence = getCurrentSentenceMark(this.marks, audioTimeSeconds);
    if (sentence) {
      const sIdx = this.marks.findIndex(
        (m) => m.type === "sentence" && m.start === sentence.start && m.end === sentence.end,
      );
      if (sIdx !== this.currentSentenceIndex) {
        this.currentSentenceIndex = sIdx;
        this.currentSentence = sentence;
        this.emit("sentence", { sentence, index: sIdx });
      }
    } else if (this.currentSentenceIndex !== -1) {
      this.currentSentenceIndex = -1;
      this.currentSentence = null;
      this.emit("sentence", { sentence: null, index: -1 });
    }
  }

  // -------------------------------------------------------------------------
  // PlayerControls surface — passes through to the optional underlying
  // engine for consumers that wire them together via composition.
  // -------------------------------------------------------------------------

  async play(): Promise<void> {
    /* no-op — controlled by the audio engine */
  }
  pause(): void {
    /* no-op */
  }
  seek(_timeSeconds: number): void {
    /* no-op */
  }
  setRate(_rate: number): void {
    /* no-op */
  }
  getCurrentTime(): number {
    return this.lastAudioTimeMs / 1000;
  }
  getDuration(): number {
    return 0;
  }
  getStatus(): import("./types").PlayerStatus {
    return "ready";
  }
  on<K extends PlayerEventName>(event: K, fn: PlayerListener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = fn as (p: unknown) => void;
    set.add(wrapped);
    return () => {
      this.listeners.get(event)?.delete(wrapped);
    };
  }
  dispose(): void {
    this.listeners.clear();
  }

  // -------------------------------------------------------------------------

  private emit<K extends PlayerEventName>(name: K, payload: PlayerEventMap[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as PlayerListener<K>)(payload);
      } catch {
        // Listener errors must not break the sync loop.
      }
    }
  }

  /** Inspect — current word mark (for tests). */
  inspectWord(): WordMark | null {
    return this.currentWord;
  }
  /** Inspect — current sentence mark (for tests). */
  inspectSentence(): SentenceMark | null {
    return this.currentSentence;
  }
}