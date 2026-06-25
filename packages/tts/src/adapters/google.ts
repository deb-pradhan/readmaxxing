/**
 * Google Cloud TTS adapter — stub.
 *
 * Phase 2 wiring:
 *   import { TextToSpeechClient } from "@google-cloud/text-to-speech";
 *   const client = new TextToSpeechClient();
 *   const [response] = await client.synthesizeSpeech({...});
 *   // response.audioContent is a Buffer; align via timepoints[].
 *
 * Throws "not configured" until Phase 2.
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "../provider";

const STATIC_VOICES: Voice[] = [
  { id: "google_en_us_wavenet_f", name: "Google US English Female (Wavenet)", provider: "google", language: "en-US", free: false, isMarquee: false },
  { id: "google_en_us_wavenet_d", name: "Google US English Male (Wavenet)", provider: "google", language: "en-US", free: false, isMarquee: false },
];

export class GoogleAdapter implements TTSProvider {
  readonly id = "google" as const;

  async getVoices(): Promise<Voice[]> {
    return STATIC_VOICES;
  }

  streamSynthesize(_opts: SynthesizeOptions): SynthesizeStream {
    throw new Error("Google TTS adapter: not configured (wired in Phase 2).");
  }
}