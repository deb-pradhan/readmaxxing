import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/tts — Phase 2 streaming TTS proxy entry point.
 *
 * Per the v1 plan §"TTS provider layer (Hybrid)" + UI-UX.md §4.1:
 *   - Streams chunked audio (MPEG-TS / MP3) so playback can start < 1s
 *     after the user hits Play.
 *   - Each chunk carries aligned speech marks (word/sentence timestamps)
 *     so the karaoke highlighter can sync immediately.
 *   - The client caches audio + marks in IndexedDB so subsequent reads
 *     of the same chunk are offline-first.
 *   - The route is the only path that calls TTSProvider.streamSynthesize;
 *     it picks the provider via TTSRouter (voice id, latency, free/premium).
 *
 * Phase 2 wiring replaces this stub with a streaming `Response` that pipes
 * `provider.streamSynthesize(...)` chunks through with `Transfer-Encoding:
 * chunked` and a parallel `application/x-ndjson` channel of speech marks
 * (sent as a second stream sidecar so audio frames aren't blocked on
 * mark alignment).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TtsRequestBody {
  voiceId: string;
  text: string;
  speed: number;
  documentId?: string;
  chunkIndex?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse-and-discard so the stub catches malformed JSON too.
  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body.voiceId || !body.text) {
    return NextResponse.json(
      { error: "invalid_request", message: "voiceId and text are required." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      message:
        "Phase 2 will stream audio + speech marks via the TTSRouter (ElevenLabs / OpenAI / Local).",
    },
    { status: 501 },
  );
}