/**
 * ElevenLabs TTS adapter.
 *
 * Real implementation in Phase 1: calls ElevenLabs' streaming `text-to-speech`
 * endpoint and returns the audio bytes as a single `Uint8Array` chunk,
 * alongside a heuristic word-level speech-marks list. Per the prompt
 * (`PHASE-1-STATUS.md`), real per-word timestamps are deferred to Phase 2
 * via ElevenLabs' `with_timestamps=true` query — until then the mark
 * generator is a pluggable heuristic (`heuristicSpeechMarks`) so swapping
 * is a one-line change.
 *
 * Streaming audio (chunked transfer) is deferred to Phase 2 too — we send
 * `output_format=mp3_44100_128` and `optimize_streaming_latency=3` so the
 * server kicks synthesis off quickly, but we still concatenate chunks
 * before returning. The client-side contract (`SynthesizeStream`) does not
 * change when we move to true byte-streaming.
 *
 * Endpoint reference: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "../provider";
import type { SpeechMark } from "../speech-mark";
import { heuristicSpeechMarks } from "../speech-marks";
import { tokenizeForMarks } from "./_tokenize";

export interface ElevenLabsAdapterOptions {
  apiKey: string;
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /** Override the base URL — default `https://api.elevenlabs.io`. */
  baseUrl?: string;
  /** Default voice model id. */
  defaultModelId?: string;
  /**
   * Mark generator — pluggable for tests + for swapping in the real
   * `with_timestamps` alignment in Phase 2. Defaults to the heuristic
   * word-splitter.
   */
  markGenerator?: (text: string, opts: SynthesizeOptions) => SpeechMark[];
}

/** Static voice catalog. Replaced by `client.voices.getAll()` in Phase 2. */
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
  {
    id: "eleven_bella",
    name: "Bella",
    provider: "elevenlabs",
    language: "en-US",
    label: "Bright, conversational",
    free: false,
    isMarquee: false,
  },
  {
    id: "eleven_antoni",
    name: "Antoni",
    provider: "elevenlabs",
    language: "en-US",
    label: "Bright, warm",
    free: false,
    isMarquee: false,
  },
  {
    id: "eleven_josh",
    name: "Josh",
    provider: "elevenlabs",
    language: "en-US",
    label: "Deep, narrative",
    free: false,
    isMarquee: false,
  },
  {
    id: "elven_elli",
    name: "Elli",
    provider: "elevenlabs",
    language: "en-US",
    label: "Young, casual",
    free: false,
    isMarquee: false,
  },
];

const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export class ElevenLabsAdapter implements TTSProvider {
  readonly id = "elevenlabs" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly markGenerator: (text: string, opts: SynthesizeOptions) => SpeechMark[];

  constructor(opts: ElevenLabsAdapterOptions) {
    if (!opts.apiKey) {
      throw new Error("ElevenLabsAdapter: apiKey is required.");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.modelId = opts.defaultModelId ?? DEFAULT_MODEL_ID;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.markGenerator =
      opts.markGenerator ??
      ((text: string, o: SynthesizeOptions) =>
        ElevenLabsAdapter.defaultMarkGenerator(text, o));
  }

  async getVoices(): Promise<Voice[]> {
    return STATIC_VOICES;
  }

  streamSynthesize(opts: SynthesizeOptions): SynthesizeStream {
    const chunkIndex = 0;
    const self = this;
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
        if (!opts.voiceId || !opts.text) {
          return { value: undefined, done: true };
        }
        const url = `${self.baseUrl}/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/stream?output_format=mp3_44100_128&optimize_streaming_latency=3&model_id=${encodeURIComponent(self.modelId)}`;
        const res = await self.fetchImpl(url, {
          method: "POST",
          headers: {
            "xi-api-key": self.apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: opts.text,
            model_id: self.modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              speed: opts.speed || 1.0,
            },
          }),
        });
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(
            `ElevenLabsAdapter.streamSynthesize: HTTP ${res.status} — ${errText}`,
          );
        }
        // Concatenate the (already-optimized) stream into a single chunk.
        // Phase 2 will return each chunk as its own `SynthesizeChunk`.
        const ab = await res.arrayBuffer();
        const audio = new Uint8Array(ab);
        const speechMarks = self.markGenerator(opts.text, opts);
        if (cancelled) {
          return { value: undefined, done: true };
        }
        return {
          value: { audio, speechMarks, done: true, chunkIndex },
          done: false,
        };
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

  /** Default mark generator — heuristic, used unless `markGenerator` is overridden. */
  static defaultMarkGenerator(text: string, opts: SynthesizeOptions): SpeechMark[] {
    const { words, sentences } = tokenizeForMarks(text);
    return heuristicSpeechMarks(text, words, sentences, 155, { speed: opts.speed || 1 });
  }
}