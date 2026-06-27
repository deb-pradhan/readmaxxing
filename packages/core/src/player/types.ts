/**
 * Player-internal types — discriminated subsets of `SpeechMark` plus the
 * event-emitter interface used by `KaraokeSync` and `AudioEngine`.
 *
 * The shapes mirror `SpeechMark` from `@readmaxxing/tts` so callers can pass
 * raw speech-mark arrays without re-wrapping.
 */

import type { SpeechMark } from "@readmaxxing/tts";

/** Word-level speech mark. */
export interface WordMark {
  type: "word";
  start: number;
  end: number;
  timeSeconds: number;
  text: string;
}

/** Sentence-level speech mark. */
export interface SentenceMark {
  type: "sentence";
  start: number;
  end: number;
  timeSeconds: number;
  text: string;
}

/** Either kind of mark — re-exported for convenience. */
export type AnySpeechMark = SpeechMark | WordMark | SentenceMark;

/**
 * Subscribable event map for the audio engine + karaoke sync. Listeners are
 * keyed by event name; multiple listeners per event are allowed.
 */
export interface PlayerEventMap {
  /** Emitted when audio transitions between playing/paused/ended. */
  status: { status: PlayerStatus };
  /** Emitted on every timeupdate with the current playback time. */
  time: { currentTime: number; duration: number };
  /** Emitted when the active word changes. */
  word: { word: WordMark | null; index: number };
  /** Emitted when the active sentence changes. */
  sentence: { sentence: SentenceMark | null; index: number };
  /** Emitted when the audio engine detects >150ms drift. */
  drift: { driftMs: number; currentTime: number };
  /** Emitted on error. */
  error: { error: Error };
  /** Emitted on end-of-stream. */
  end: Record<string, never>;
}

export type PlayerEventName = keyof PlayerEventMap;

export type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

/**
 * Audio engine configuration. `fetchStream` is called once per source; it
 * returns a `ReadableStream<Uint8Array>` of encoded audio bytes. The engine
 * buffers, decodes, and plays them.
 */
export interface AudioEngineConfig {
  /** Async source of raw audio bytes. */
  fetchStream: () => Promise<ReadableStream<Uint8Array>>;
  /** Sample rate hint for the decoder (Hz). Defaults to 44100. */
  sampleRate?: number;
  /** Initial playback rate. */
  initialRate?: number;
  /** Optional AudioContext factory (for tests). */
  audioContextFactory?: () => AudioContextLike;
  /** Drift threshold in ms before emitting `drift`. Default 150. */
  driftThresholdMs?: number;
}

/**
 * Minimal AudioContext interface — narrowed to the calls we make so tests
 * can mock it cleanly.
 */
export interface AudioContextLike {
  readonly sampleRate: number;
  readonly destination: AudioNode;
  readonly currentTime: number;
  readonly state: AudioContextState;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Public player methods — what the consuming UI calls. Both audio-engine and
 * karaoke-sync publish this shape.
 */
export interface PlayerControls {
  play(): Promise<void>;
  pause(): void;
  seek(timeSeconds: number): void;
  setRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getStatus(): PlayerStatus;
  on<K extends PlayerEventName>(event: K, fn: (payload: PlayerEventMap[K]) => void): () => void;
  dispose(): void;
}

/** Listener map — stored on the engine for `on(...)` registration. */
export type PlayerListener<K extends PlayerEventName> = (
  payload: PlayerEventMap[K],
) => void;