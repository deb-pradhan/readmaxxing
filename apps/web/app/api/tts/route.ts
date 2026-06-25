/**
 * /api/tts — synthesize text into MP3 audio + heuristic speech marks.
 *
 * Phase 1:
 *   - POST { voiceId, text, speed, documentId? } →
 *     { audioBase64, marks, durationSeconds }
 *   - The route uses ElevenLabs' streaming endpoint with
 *     `optimize_streaming_latency=3` so the server starts sending audio
 *     quickly. We accumulate into one chunk for Phase 1; Phase 2 returns
 *     true byte-streaming via a chunked Response body.
 *   - Marks are heuristic (`60000/wpm/speed` per word). Phase 2 swaps in
 *     ElevenLabs' `with_timestamps=true` alignment — see PHASE-1-STATUS.md.
 *
 * GET → list of voices from the ElevenLabs adapter (with the static
 *   fallback when the API key is unset).
 *
 * The route enforces the `x-dev-user-id` (Phase 1) / `x-user-id` (Phase 2)
 * header via `apps/web/middleware.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ElevenLabsAdapter } from "@readmaxxing/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  voiceId: z.string().min(1).max(200),
  text: z.string().min(1).max(50_000),
  speed: z.number().min(0.5).max(4.5).default(1),
  documentId: z.string().optional(),
});

export async function POST(request: NextRequest) {
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
        message:
          "ELEVENLABS_API_KEY is not set. Add it to .env (see README).",
      },
      { status: 503 },
    );
  }

  const adapter = new ElevenLabsAdapter({ apiKey });
  try {
    const stream = adapter.streamSynthesize({
      voiceId: body.voiceId,
      text: body.text,
      speed: body.speed,
      format: "mp3",
      tier: "free",
    });
    let audio: Uint8Array | null = null;
    let marks: Array<{
      type: "word" | "sentence" | "ssml";
      start: number;
      end: number;
      timeSeconds: number;
      text: string;
    }> = [];
    for await (const chunk of stream) {
      if (chunk.done && chunk.audio) audio = chunk.audio;
      if (chunk.speechMarks?.length) marks = chunk.speechMarks;
    }
    if (!audio || audio.length === 0) {
      return NextResponse.json(
        { error: "provider_error", message: "ElevenLabs returned no audio." },
        { status: 502 },
      );
    }
    const audioBase64 = bytesToBase64(audio);
    return NextResponse.json(
      {
        audioBase64,
        marks,
        durationSeconds: 0, // filled by the client once metadata loads
        fromCache: false,
      },
      {
        headers: {
          // Hint the client to cache the response — same `(text, voice, speed)`
          // produces the same bytes deterministically (modulo ElevenLabs' own
          // synthesis jitter).
          "Cache-Control": "private, max-age=86400",
        },
      },
    );
  } catch (err) {
    console.error("tts.POST failed", err);
    return NextResponse.json(
      {
        error: "provider_error",
        message: `ElevenLabs synthesis failed: ${(err as Error).message}`,
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  // Listing voices doesn't require auth — it's the same static catalog.
  const adapter = new ElevenLabsAdapter({
    apiKey: process.env["ELEVENLABS_API_KEY"] ?? "stub",
  });
  try {
    const voices = await adapter.getVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    return NextResponse.json(
      { error: "provider_error", message: (err as Error).message },
      { status: 502 },
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return Buffer.from(bin, "binary").toString("base64");
}