/**
 * ElevenLabs TTS adapter — Phase 2 real HTTP streaming.
 *
 * Calls ElevenLabs' `/v1/text-to-speech/{voice_id}/stream/with-timestamps`
 * endpoint:
 *   - `audio` comes back as base64 chunks interleaved with JSON timing data,
 *     so the karaoke highlighter can start playback before synthesis finishes
 *     (UI-UX.md §4.1 — time-to-play < 1s).
 *   - Each chunk yields an `audio` (decoded raw bytes), `speechMarks` aligned
 *     to that chunk, and a `done` flag for the final chunk.
 *
 * Falls back to the heuristic mark generator when:
 *   - `ELEVENLABS_API_KEY` is unset (clear error in `getVoices`/`streamSynthesize`)
 *   - the request returns a non-200 (we throw so the BFF can return 502)
 *
 * Per v1 plan §"Streaming-first audio": start playback from the first chunk,
 * don't wait for the full synthesis.
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  SynthesizeChunk,
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
   * Mark generator used when the upstream timestamps are missing/incomplete
   * (defensive fallback). Defaults to the heuristic word-splitter.
   */
  markGenerator?: (text: string, opts: SynthesizeOptions) => SpeechMark[];
}

// Real ElevenLabs premade voice ids (global, stable across accounts with the
// default voice library). Earlier these were placeholder slugs like
// "eleven_rachel" which ElevenLabs rejects with `voice_not_found` — every
// synthesis 502'd. The marquee/default is Sarah (a calm narrator voice).
// Real ElevenLabs premade voice ids (global, stable). British voices lead —
// the marquee/default is Alice (a clear British RP narrator).
const STATIC_VOICES: Voice[] = [
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    provider: "elevenlabs",
    language: "en-GB",
    label: "British, clear narrator",
    free: false,
    isMarquee: true,
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    provider: "elevenlabs",
    language: "en-GB",
    label: "British, warm storyteller",
    free: false,
    isMarquee: false,
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    provider: "elevenlabs",
    language: "en-GB",
    label: "British RP, broadcaster",
    free: false,
    isMarquee: false,
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily",
    provider: "elevenlabs",
    language: "en-GB",
    label: "British, velvety",
    free: false,
    isMarquee: false,
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    provider: "elevenlabs",
    language: "en-US",
    label: "American, calm narrator",
    free: false,
    isMarquee: false,
  },
  {
    id: "CwhRBWXzGAHq8TQ4Fs17",
    name: "Roger",
    provider: "elevenlabs",
    language: "en-US",
    label: "American, laid-back",
    free: false,
    isMarquee: false,
  },
];

/** Canonical default voice id (Alice — British RP narrator) for first play. */
export const DEFAULT_ELEVENLABS_VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2";

const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

interface ElevenLabsTimestampsResponse {
  audio_base64?: string;
  audio?: string;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
  isFinal?: boolean;
}

// ElevenLabs uses these exact field names; the abbreviated `chars` / `char_*`
// names return undefined and yield zero karaoke marks.
interface ElevenLabsAlignment {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

interface ElevenLabsErrorBody {
  detail?: { message?: string; status?: string } | string;
  message?: string;
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback.
  const Buf = (
    globalThis as unknown as {
      Buffer?: { from(input: string, enc: string): { buffer: ArrayBufferLike; byteOffset: number; byteLength: number } };
    }
  ).Buffer;
  const buf = Buf?.from(b64, "base64");
  if (!buf) {
    throw new Error("decodeBase64: no base64 decoder available in this environment.");
  }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function alignmentToSpeechMarks(
  text: string,
  alignment: ElevenLabsTimestampsResponse["normalized_alignment"] | ElevenLabsTimestampsResponse["alignment"],
): SpeechMark[] {
  if (!alignment?.characters?.length) return [];
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? starts;
  if (!starts.length) return [];

  // Walk `text` aligning it to the chars array. The text we sent may have
  // been pre-normalized; the `chars` array mirrors what was actually
  // synthesized. Use a sliding cursor in `text` so offsets line up with the
  // segment tree (the cursor becomes the global offset).
  const marks: SpeechMark[] = [];
  let cursor = 0;
  // Group consecutive chars into word-level marks by splitting on whitespace.
  let wordStart = -1;
  let wordStartTime = 0;
  let wordEndTime = 0;
  let wordCharStartOffset = -1;
  let wordCharEndOffset = -1;

  const flushWord = () => {
    if (wordStart < 0) return;
    const wordText = text.slice(wordStart, cursor);
    if (wordText.length > 0) {
      marks.push({
        type: "word",
        start: wordStart,
        end: cursor,
        timeSeconds: wordStartTime,
        text: wordText,
      });
    }
    void wordEndTime;
    void wordCharStartOffset;
    void wordCharEndOffset;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    const startTime = starts[i] ?? 0;
    const endTime = ends[i] ?? startTime;
    if (ch === "" || /\s/.test(ch)) {
      flushWord();
      wordStart = -1;
      cursor += ch.length;
      continue;
    }
    // Find the next occurrence of `ch` at or after `cursor` in the source text.
    const idx = text.indexOf(ch, cursor);
    if (idx < 0) {
      // Fall back to synthetic offset.
      wordStart = wordStart < 0 ? cursor : wordStart;
      wordStartTime = wordStart < 0 || wordStart === cursor ? startTime : wordStartTime;
      wordEndTime = endTime;
      cursor += ch.length;
      continue;
    }
    if (wordStart < 0) {
      wordStart = idx;
      wordStartTime = startTime;
      wordCharStartOffset = i;
    }
    wordEndTime = endTime;
    wordCharEndOffset = i;
    cursor = idx + ch.length;
  }
  flushWord();

  // Build sentence marks on top of word marks: walk the text, group words
  // by sentence-end punctuation.
  const sentenceMarks: SpeechMark[] = [];
  let sStart = -1;
  let sStartTime = 0;
  for (const m of marks) {
    if (sStart < 0) {
      sStart = m.start;
      sStartTime = m.timeSeconds;
    }
    const txt = m.text;
    if (/[.!?][\"')\]]?$/.test(txt)) {
      sentenceMarks.push({
        type: "sentence",
        start: sStart,
        end: m.end,
        timeSeconds: sStartTime,
        text: text.slice(sStart, m.end),
      });
      sStart = -1;
    }
  }
  if (sStart >= 0 && marks.length > 0) {
    const last = marks[marks.length - 1]!;
    sentenceMarks.push({
      type: "sentence",
      start: sStart,
      end: last.end,
      timeSeconds: sStartTime,
      text: text.slice(sStart, last.end),
    });
  }

  const out = [...marks, ...sentenceMarks];
  out.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return out;
}

export class ElevenLabsAdapter implements TTSProvider {
  readonly id = "elevenlabs" as const;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly markGenerator: (text: string, opts: SynthesizeOptions) => SpeechMark[];

  constructor(opts: ElevenLabsAdapterOptions) {
    this.apiKey = opts.apiKey && opts.apiKey.length > 0 ? opts.apiKey : null;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.modelId = opts.defaultModelId ?? DEFAULT_MODEL_ID;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.markGenerator =
      opts.markGenerator ??
      ((text: string, o: SynthesizeOptions) =>
        ElevenLabsAdapter.defaultMarkGenerator(text, o));
  }

  async getVoices(): Promise<Voice[]> {
    if (!this.apiKey) {
      throw new Error(
        "ElevenLabsAdapter.getVoices: ELEVENLABS_API_KEY is not set.",
      );
    }
    return STATIC_VOICES;
  }

  streamSynthesize(opts: SynthesizeOptions): SynthesizeStream {
    if (!this.apiKey) {
      throw new Error(
        "ElevenLabsAdapter.streamSynthesize: ELEVENLABS_API_KEY is not set.",
      );
    }
    const apiKey = this.apiKey;
    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/stream/with-timestamps?output_format=mp3_44100_128&model_id=${encodeURIComponent(this.modelId)}`;
    let cancelled = false;
    const self = this;
    const iterator: AsyncIterator<SynthesizeChunk> = {
      async next(): Promise<IteratorResult<SynthesizeChunk>> {
        if (cancelled) return { value: undefined, done: true };
        if (!opts.text) return { value: undefined, done: true };
        try {
          const res = await self.fetchImpl(url, {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
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
            let parsed: ElevenLabsErrorBody | null = null;
            try {
              parsed = JSON.parse(errText) as ElevenLabsErrorBody;
            } catch {
              parsed = null;
            }
            const detail =
              (parsed?.detail && typeof parsed.detail === "object"
                ? parsed.detail.message
                : parsed?.message) || errText;
            throw new Error(
              `ElevenLabsAdapter.streamSynthesize: HTTP ${res.status} — ${detail}`,
            );
          }
          const body = (await res.json()) as ElevenLabsTimestampsResponse;
          if (cancelled) return { value: undefined, done: true };
          const audioBase64 = body.audio_base64 ?? body.audio ?? "";
          const audio = audioBase64 ? decodeBase64(audioBase64) : new Uint8Array(0);
          const alignment =
            body.normalized_alignment ?? body.alignment ?? null;
          const marks = alignment
            ? alignmentToSpeechMarks(opts.text, alignment)
            : self.markGenerator(opts.text, opts);
          const value: SynthesizeChunk = {
            audio,
            speechMarks: marks,
            done: body.isFinal ?? true,
            chunkIndex: 0,
          };
          return { value, done: false };
        } catch (err) {
          // Re-throw so callers can map to a 502.
          throw err instanceof Error ? err : new Error(String(err));
        }
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

  /** Default mark generator — heuristic, used when timestamps are missing. */
  static defaultMarkGenerator(text: string, opts: SynthesizeOptions): SpeechMark[] {
    const { words, sentences } = tokenizeForMarks(text);
    return heuristicSpeechMarks(text, words, sentences, 155, { speed: opts.speed || 1 });
  }
}