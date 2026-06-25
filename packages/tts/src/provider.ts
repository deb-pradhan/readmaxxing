/**
 * TTSProvider — the contract every TTS adapter (ElevenLabs, OpenAI, Azure,
 * Google, Local, XTTS) implements. The router picks an adapter per request
 * by voice id, latency, cost, and a free-vs-premium flag.
 *
 * Per v1 plan §"TTS provider layer (Hybrid)": streaming-first, with
 * speech marks returned alongside the audio so karaoke can advance
 * before full synthesis finishes (UI-UX.md §4.1 — time-to-play < 1s).
 */

import type { SpeechMark } from "./speech-mark";

export type TtsProviderId =
  | "elevenlabs"
  | "openai"
  | "azure"
  | "google"
  | "local"
  | "xtts";

export interface Voice {
  /** Provider-specific voice id. */
  id: string;
  /** Display name. */
  name: string;
  /** Provider the voice belongs to. */
  provider: TtsProviderId;
  /** BCP-47 language code. */
  language: string;
  /** Optional descriptive label (gender, age, accent). */
  label?: string;
  /** When true, available without a paid plan. */
  free: boolean;
  /** When true, this is a marquee/celebrity default surfaced on first run. */
  isMarquee: boolean;
  /** Optional preview audio URL. */
  previewUrl?: string;
}

export interface SynthesizeOptions {
  voiceId: string;
  /** Plain text to synthesize. */
  text: string;
  /** Playback speed (0.5 – 4.5). Pitch-preserving. */
  speed: number;
  /** Format of the returned audio bytes. */
  format: "mp3" | "mpeg-ts" | "wav" | "opus";
  /** BCP-47 language code override; defaults to voice language. */
  language?: string;
  /** Free vs premium user tier — affects cost / quality routing. */
  tier: "free" | "premium";
}

export interface SynthesizeChunk {
  /** Audio bytes (raw; never base64-encoded). */
  audio: Uint8Array;
  /** Speech marks for *this* chunk. */
  speechMarks: SpeechMark[];
  /** Whether the stream has ended. */
  done: boolean;
  /** Index of the chunk within the original text (for chunked synthesis). */
  chunkIndex: number;
}

/** A streaming synthesis result — async iterable over audio chunks. */
export interface SynthesizeStream {
  [Symbol.asyncIterator](): AsyncIterator<SynthesizeChunk>;
  /** Cancel in-flight synthesis. */
  cancel(): void;
}

export interface CloneVoiceOptions {
  /** Short audio sample (WAV/MP3) of the speaker. */
  samples: Blob[];
  /** Consent text the user must affirm. */
  consentAffirmed: true;
  /** Display name for the cloned voice. */
  name: string;
}

export interface TTSProvider {
  readonly id: TtsProviderId;
  /** Static list of voices available from this provider. */
  getVoices(): Promise<Voice[]>;
  /**
   * Stream-synthesize text. Returns chunks of audio + aligned speech marks
   * as they arrive. The first chunk should be small enough to start playback
   * in < 1s per UI-UX.md §4.1.
   */
  streamSynthesize(opts: SynthesizeOptions): SynthesizeStream;
  /** Clone a voice from user-provided samples. */
  cloneVoice?(opts: CloneVoiceOptions): Promise<Voice>;
}