import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/positions — Phase 2 SSE entry point for cross-device position sync.
 *
 * Per the v1 plan §"Sync engine": the BFF reads `playback_positions` from
 * Railway Postgres and streams an SSE event whenever `updatedAt` advances for
 * the authenticated user. The web client uses this to drive the "Continue
 * listening" shelf and the exact-word resume.
 *
 * Phase 2 wires:
 *   - Streamed as `text/event-stream` with `event: position` frames.
 *   - Poll `PlaybackPosition` every ~1.5s OR subscribe to Postgres LISTEN/NOTIFY
 *     for sub-second updates.
 *   - Close the stream when the client disconnects (request.signal aborted).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "not_implemented",
      message: "Phase 2 will stream SSE position events from PlaybackPosition.",
    },
    { status: 501 },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}