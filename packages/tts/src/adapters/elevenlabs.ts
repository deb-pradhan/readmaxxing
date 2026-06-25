/**
 * ElevenLabs TTS adapter.
 *
 * Phase 1: typed against the ElevenLabs JS SDK contract (`@elevenlabs/elevenlabs-js`)
 * but the SDK is not installed in this phase. The methods compile and throw
 * a clear "not configured" error when called; Phase 2 installs the SDK and
 * wires the real `streamWithTimestamps` call.
 *
 * Reference (intended Phase 2 wiring):
 *
 *   import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
 *   const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
 *   const stream = await client.textToSpeech.streamWithTimestamps({
 *     voice_id: voiceId,
 *     text,
 *     model_id: "eleven_multilingual_v2",
 *     voice_settings: { speed, ... },
 *   });
 *   for await (const chunk of stream) {
 *     yield {
 *       audio: chunk.audio,
 *       speechMarks: chunk.alignment?.characters.map((c, i) => ({...})),
 *       done: false,
 *       chunkIndex,
 *     };
 *   }
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "../provider";
import type { SpeechMark } from "../speech-mark";

export interface ElevenLabsAdapterOptions {
  apiKey: string;
  defaultModelId?: string;
  /** Override the fetch implementation for tests. */
  fetchImpl?: typeof fetch;
}

/** Voice catalog hardcoded for Phase 1 — replaced by `client.voices.getAll()` in Phase 2. */
const STATIC_VOICES: Voice[] = [
  {
    id: "eleven_rachel",
    name: "Rachel",
    provider: "elevenlabs",
    language: "en-US",
    label: "Calm, narrator",
    free: false,
    isMarquee: true,
  },
  {
    id: "eleven_drew",
    name: "Drew",
    provider: "elevenlabs",
    language: "en-US",
    label: "Warm, friendly",
    free: false,
    isMarquee: false,
  },
];

export class ElevenLabsAdapter implements TTSProvider {
  readonly id = "elevenlabs" as const;
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ElevenLabsAdapterOptions) {
    this.apiKey = opts.apiKey;
    this.modelId = opts.defaultModelId ?? "eleven_multilingual_v2";
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async getVoices(): Promise<Voice[]> {
    // Phase 1: return the static catalog so the router has something to render.
    return STATIC_VOICES;
  }

  streamSynthesize(opts: SynthesizeOptions): SynthesizeStream {
    const chunkIndex = 0;
    const speechMarks: SpeechMark[] = [];
    let cancelled = false;

    const iterator: AsyncIterator<{
      audio: Uint8Array;
      speechMarks: SpeechMark[];
      done: boolean;
      chunkIndex: number;
    }> = {
      async next() {
        if (cancelled) {
          return { value: undefined, done: true };
        }
        // Phase 1 — wired in Phase 2 once `@elevenlabs/elevenlabs-js` is installed.
        // The shape returned below matches the SDK's `streamWithTimestamps` chunks.
        if (!opts.voiceId || opts.text.length === 0) {
          return { value: undefined, done: true };
        }
        throw new Error(
          "ElevenLabsAdapter.streamSynthesize: SDK not installed (wired in Phase 2).",
        );
        // Unreachable — keeps TypeScript satisfied when Phase 2 wires the real impl.
        return { value: { audio: new Uint8Array(), speechMarks, done: true, chunkIndex }, done: true };
      },
    };

    return {
      [Symbol.asyncIterator]() {
        return iterator;
      },
      cancel() {
        cancelled = true;
      },
    };
  }
}