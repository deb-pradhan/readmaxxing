/**
 * /api/ai/podcasts/[id]/stream — proxy the worker's audio with Range support.
 *
 * The episode audio lives on the Railway volume mounted in the worker.
 * The BFF authenticates the request and forwards the Range header so the
 * player's `<audio>` tag can seek without buffering the whole file.
 *
 * Per TESTING.md §9 the route emits `podcast.stream_start` (range info only,
 * never bytes) and a clean 502 if the worker is unreachable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const episode = await db().podcastEpisode.findFirst({
    where: { id: params.id, userId },
    select: { id: true, status: true, audioPath: true, title: true },
  });
  if (!episode) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (episode.status !== "completed") {
    return new Response(
      JSON.stringify({
        error: "not_ready",
        message: "Episode isn't ready to play yet.",
        status: episode.status,
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const base = process.env["WORKER_API_URL"];
  if (!base) {
    return new Response(
      JSON.stringify({
        error: "worker_unreachable",
        message: "Audio worker is not configured.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const rangeHeader = request.headers.get("range") ?? request.headers.get("Range");

  log.info({
    event: "podcast.stream_start",
    request_id: requestId,
    episode_id: episode.id,
    has_range: Boolean(rangeHeader),
  });

  try {
    const upstream = await fetch(
      `${base}/v1/podcast/${encodeURIComponent(episode.id)}/audio`,
      {
        method: "GET",
        headers: rangeHeader ? { Range: rangeHeader } : {},
        signal: request.signal,
      },
    );
    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => upstream.statusText);
      return new Response(
        JSON.stringify({
          error: "upstream_error",
          message: `Worker returned ${upstream.status}: ${text.slice(0, 240)}`,
        }),
        {
          status: upstream.status === 404 ? 404 : 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Forward the upstream response with the same headers / status. The
    // worker already returns 206 + Content-Range when a Range is present,
    // so we copy that through verbatim.
    const headers = new Headers();
    upstream.headers.forEach((value, key) => {
      // Strip hop-by-hop / identity headers we don't want to forward.
      if (key.toLowerCase() === "transfer-encoding") return;
      headers.set(key, value);
    });
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "private, max-age=86400");
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    log.error({
      event: "podcast.stream_error",
      request_id: requestId,
      episode_id: episode.id,
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    return new Response(
      JSON.stringify({
        error: "worker_unreachable",
        message: "Couldn't reach the audio worker — retry in a moment.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}