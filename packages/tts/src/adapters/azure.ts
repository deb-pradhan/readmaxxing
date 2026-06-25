/**
 * Azure Speech TTS adapter — stub.
 *
 * Phase 2 wiring:
 *   import { SpeechConfig, AudioConfig, SpeechSynthesizer } from "microsoft-cognitiveservices-speech-sdk";
 *   const s = new SpeechSynthesizer(speechConfig, audioConfig);
 *   s.synthesisStarted / WordBoundary events → SpeechMark[].
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
  { id: "azure_jenny", name: "Jenny (Azure)", provider: "azure", language: "en-US", free: false, isMarquee: false },
  { id: "azure_guy", name: "Guy (Azure)", provider: "azure", language: "en-US", free: false, isMarquee: false },
];

export class AzureAdapter implements TTSProvider {
  readonly id = "azure" as const;

  async getVoices(): Promise<Voice[]> {
    return STATIC_VOICES;
  }

  streamSynthesize(_opts: SynthesizeOptions): SynthesizeStream {
    throw new Error("Azure TTS adapter: not configured (wired in Phase 2).");
  }
}