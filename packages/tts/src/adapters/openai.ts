/**
 * OpenAI TTS adapter — stub.
 *
 * Phase 2 wiring:
 *   import OpenAI from "openai";
 *   const client = new OpenAI({ apiKey });
 *   const speech = await client.audio.speech.create({
 *     model: "gpt-4o-mini-tts",
 *     voice: opts.voiceId,
 *     input: opts.text,
 *     speed: opts.speed,
 *     response_format: opts.format === "mp3" ? "mp3" : "opus",
 *   });
 *   // Stream response.body into chunks. Speech marks are derived via forced
 *   // alignment in the worker since OpenAI does not return native timestamps.
 *
 * Throws "not configured" until Phase 2.
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "../provider";
import type { SpeechMark } from "../speech-mark";

const STATIC_VOICES: Voice[] = [
  { id: "openai_alloy", name: "Alloy", provider: "openai", language: "en-US", free: false, isMarquee: false },
  { id: "openai_echo", name: "Echo", provider: "openai", language: "en-US", free: false, isMarquee: false },
  { id: "openai_nova", name: "Nova", provider: "openai", language: "en-US", free: false, isMarquee: false },
  { id: "openai_shimmer", name: "Shimmer", provider: "openai", language: "en-US", free: false, isMarquee: false },
];

export class OpenAIAdapter implements TTSProvider {
  readonly id = "openai" as const;

  async getVoices(): Promise<Voice[]> {
    return STATIC_VOICES;
  }

  streamSynthesize(_opts: SynthesizeOptions): SynthesizeStream {
    throw new Error(
      "OpenAI TTS adapter: post-alignment not configured (wired in Phase 2).",
    );
  }
}

export type { SpeechMark };