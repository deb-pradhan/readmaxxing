/**
 * /api/tts — streaming TTS proxy.
 *
 * Phase 2: the route streams NDJSON `SpeechMarkChunk`s back to the client.
 * Each line is a JSON object with `audio` (base64-encoded MP3 bytes),
 * `speechMarks` aligned to that chunk, and `done` for the final frame.
 *
 * The client (`apps/web/components/player/Player.tsx`) feeds the stream to
 * `AudioEngine.consumeStream()` which buffers, decodes, and plays the
 * first chunk immediately — UI-UX.md §4.1 (time-to-play < 1s).
 *
 * The route enforces the `x-user-id` (or dev `x-dev-user-id`) header via
 * `apps/web/middleware.ts`. When `ELEVENLABS_API_KEY` is unset we return
 * 503 with a clear message — no silent fallback.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ElevenLabsAdapter } from "@readmaxxing/tts";
import type { SpeechMark } from "@readmaxxing/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  voiceId: z.string().min(1).max(200),
  text: z.string().min(1).max(500_000),
  speed: z.number().min(0.5).max(4.5).default(1),
  documentId: z.string().optional(),
});

// ElevenLabs hard limit is 10,000 chars/request. We deliberately chunk much
// smaller so long docs split into MORE pieces that synthesize concurrently —
// wall-clock ≈ total / concurrency, so smaller chunks = faster generation.
const MAX_TTS_CHARS = 4500;
// Cap concurrent ElevenLabs requests to avoid provider rate limits (429s).
const TTS_CONCURRENCY = 4;

interface ChunkResult {
  audioBytes: Uint8Array;
  marks: SpeechMark[];
  durationSeconds: number;
}

interface ElevenLabsAlignment {
  // ElevenLabs uses these exact field names; the abbreviated `chars` /
  // `char_*` names return undefined and yield zero karaoke marks.
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

interface ElevenLabsTimestampsResponse {
  audio_base64?: string;
  audio?: string;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
  isFinal?: boolean;
}

interface SpeechMarkChunk {
  /** Base64-encoded MP3 / MPEG-TS bytes for this chunk. */
  audio: string;
  /** Speech marks aligned to this chunk. */
  marks: SpeechMark[];
  /** True for the final chunk; client may close the stream. */
  done: boolean;
  /** Index of the chunk within the synthesis. */
  chunkIndex: number;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "no_provider_key",
        message: "ELEVENLABS_API_KEY is not set. Add it to .env (see README).",
      },
      { status: 503 },
    );
  }

  // ElevenLabs rejects text > 10,000 chars (`text_too_long`). Split long text
  // into ≤ MAX_TTS_CHARS contiguous slices, synthesize them in parallel
  // (bounded concurrency), then stitch the audio and rebase each chunk's
  // speech marks by its character offset + cumulative audio duration. A short
  // doc is just a single chunk, so this is a no-op for the common case.
  const chunks = splitTextForTts(body.text, MAX_TTS_CHARS);

  let synthesized: ChunkResult[];
  try {
    synthesized = await mapWithConcurrency(chunks, TTS_CONCURRENCY, (c) =>
      synthesizeChunk(c.text, body.voiceId, body.speed, apiKey),
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "provider_error",
        message: (err as Error).message.slice(0, 300),
      },
      { status: 502 },
    );
  }

  // Stitch: concatenate audio bytes; rebase marks by char offset + time.
  const audioParts: Uint8Array[] = [];
  const marks: SpeechMark[] = [];
  let timeOffset = 0;
  for (let i = 0; i < synthesized.length; i++) {
    const r = synthesized[i]!;
    const charOffset = chunks[i]!.start;
    audioParts.push(r.audioBytes);
    for (const m of r.marks) {
      marks.push({
        ...m,
        start: m.start + charOffset,
        end: m.end + charOffset,
        timeSeconds: m.timeSeconds + timeOffset,
      });
    }
    timeOffset += r.durationSeconds;
  }

  const combined = Buffer.concat(audioParts.map((p) => Buffer.from(p)));
  const audioBase64 = combined.toString("base64");

  const chunk: SpeechMarkChunk = {
    audio: audioBase64,
    marks,
    done: true,
    chunkIndex: 0,
  };

  const body_text = JSON.stringify(chunk) + "\n";
  return new Response(body_text, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function GET(): Promise<NextResponse> {
  const adapter = new ElevenLabsAdapter({
    apiKey: process.env["ELEVENLABS_API_KEY"] ?? "",
  });
  try {
    const voices = await adapter.getVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    return NextResponse.json(
      {
        voices: [],
        warning: (err as Error).message,
      },
      { status: 200 },
    );
  }
}

function alignmentToSpeechMarks(
  alignment: ElevenLabsAlignment | null,
): SpeechMark[] {
  if (!alignment?.characters?.length) return [];
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds ?? [];
  if (!starts.length) return [];

  // ElevenLabs `characters` is the spoken text as a per-character sequence,
  // in order. Walk it in lockstep, tracking a running character offset, and
  // group runs of non-whitespace into word marks. Offsets index into the
  // joined character string (== the text we sent), so they line up with the
  // segment tree the highlighter renders.
  const marks: SpeechMark[] = [];
  const joined = chars.join("");
  let offset = 0;
  let wordStart = -1;
  let wordStartTime = 0;

  const flushWord = (end: number) => {
    if (wordStart < 0) return;
    const wordText = joined.slice(wordStart, end);
    if (wordText.length > 0) {
      marks.push({
        type: "word",
        start: wordStart,
        end,
        timeSeconds: wordStartTime,
        text: wordText,
      });
    }
    wordStart = -1;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    if (ch === "" || /\s/.test(ch)) {
      flushWord(offset);
    } else if (wordStart < 0) {
      wordStart = offset;
      wordStartTime = starts[i] ?? 0;
    }
    offset += ch.length;
  }
  flushWord(offset);

  // Sentence marks — split on terminal punctuation within words.
  const sentenceMarks: SpeechMark[] = [];
  let sStart = -1;
  let sStartTime = 0;
  for (const m of marks) {
    if (sStart < 0) {
      sStart = m.start;
      sStartTime = m.timeSeconds;
    }
    if (/[.!?]["')\]]?$/.test(m.text)) {
      sentenceMarks.push({
        type: "sentence",
        start: sStart,
        end: m.end,
        timeSeconds: sStartTime,
        text: joined.slice(sStart, m.end),
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
      text: joined.slice(sStart, last.end),
    });
  }
  const out = [...marks, ...sentenceMarks];
  out.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return out;
}

/**
 * Split text into contiguous slices of at most `maxChars`, preferring to break
 * at paragraph, then sentence, then word boundaries. Slices concatenate back
 * to the original text exactly, so `start` offsets line up with the segment
 * tree (and thus the karaoke marks after rebasing).
 */
export function splitTextForTts(
  text: string,
  maxChars: number,
): Array<{ text: string; start: number }> {
  const chunks: Array<{ text: string; start: number }> = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(i, end);
      const minBreak = Math.floor(maxChars * 0.5);
      const para = slice.lastIndexOf("\n\n");
      const sentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("\n"),
      );
      const space = slice.lastIndexOf(" ");
      let breakAt = slice.length;
      if (para >= minBreak) breakAt = para + 2;
      else if (sentence >= minBreak) breakAt = sentence + 2;
      else if (space > 0) breakAt = space + 1;
      end = i + breakAt;
    }
    chunks.push({ text: text.slice(i, end), start: i });
    i = end;
  }
  return chunks;
}

/** Run `fn` over `items` with at most `limit` in flight; preserves order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]!, idx);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/** Synthesize one ≤10k-char chunk via ElevenLabs `/with-timestamps`. */
async function synthesizeChunk(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
): Promise<ChunkResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs upstream failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const payload = (await res.json()) as ElevenLabsTimestampsResponse;
  const audioBase64 = payload.audio_base64 ?? payload.audio ?? "";
  const audioBytes = new Uint8Array(Buffer.from(audioBase64, "base64"));
  const alignment = payload.normalized_alignment ?? payload.alignment ?? null;
  const marks = alignment ? alignmentToSpeechMarks(alignment) : [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const durationSeconds = ends.length ? Math.max(...ends) : 0;
  return { audioBytes, marks, durationSeconds };
}