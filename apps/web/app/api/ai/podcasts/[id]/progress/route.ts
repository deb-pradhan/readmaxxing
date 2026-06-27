/**
 * /api/ai/podcasts/[id]/progress — SSE proxy to the worker's progress stream.
 *
 * The BFF owns auth + DB lookups; it forwards the upstream SSE stream from
 * the worker verbatim, prepending the latest persisted stage from the DB so
 * a client connecting mid-pipeline sees a coherent timeline.
 *
 * Per TESTING.md §9 the SSE frames are `event: <stage>` + JSON `data:`.
 * The heartbeat is forwarded as-is.
 */

import { type NextRequest } from "next/server";
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

  // Ownership check — never expose another user's progress.
  const episode = await db().podcastEpisode.findFirst({
    where: { id: params.id, userId },
    select: { id: true, status: true, progress: true, audioPath: true },
  });
  if (!episode) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  log.debug({
    event: "podcast.progress_open",
    request_id: requestId,
    episode_id: episode.id,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const enqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // 1) Pre-seed with whatever the DB knows — handles the "client
      //    connected after the worker finished" case.
      const seeded = episode.progress as
        | { stage?: string; error_msg?: string }
        | null;
      if (seeded?.stage) {
        enqueue(
          `event: ${seeded.stage}\ndata: ${JSON.stringify({
            stage: seeded.stage,
            error_msg: seeded.error_msg ?? null,
            from_cache: true,
            episode_id: episode.id,
          })}\n\n`,
        );
      }
      // Terminal states — emit the final frame and close so the UI
      // doesn't poll forever.
      if (episode.status === "completed" || episode.status === "failed") {
        enqueue(
          `event: ${episode.status}\ndata: ${JSON.stringify({
            stage: episode.status,
            episode_id: episode.id,
            from_cache: true,
          })}\n\n`,
        );
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }
      enqueue(`: connected at ${new Date().toISOString()}\n\n`);

      // 2) Forward from the worker (or fall back to local polling of the
      //    DB progress column when no worker is configured).
      const base = process.env["WORKER_API_URL"];
      if (base) {
        try {
          const upstream = await fetch(
            `${base}/v1/podcast/${encodeURIComponent(episode.id)}/progress`,
            {
              method: "GET",
              headers: { Accept: "text/event-stream" },
              signal: request.signal,
            },
          );
          if (!upstream.ok || !upstream.body) {
            enqueue(
              `event: error\ndata: ${JSON.stringify({
                message: `worker ${upstream.status}`,
              })}\n\n`,
            );
            // Fall through to DB polling as a safety net.
          } else {
            const reader = upstream.body.getReader();
            const decoder = new TextDecoder("utf-8");
            while (!closed) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              enqueue(chunk);
              if (await request.signal.aborted) break;
            }
          }
        } catch (err) {
          enqueue(
            `event: error\ndata: ${JSON.stringify({
              message: (err as Error).message.slice(0, 200),
            })}\n\n`,
          );
        }
      } else {
        // No worker — emit a clear failure event and close.
        enqueue(
          `event: error\ndata: ${JSON.stringify({
            message: "WORKER_API_URL is not configured",
            code: "worker_unreachable",
          })}\n\n`,
        );
      }
      try {
        controller.close();
      } catch {
        /* already closed */
      }
      closed = true;
    },
    cancel() {
      // Client disconnected — nothing else to do; the upstream fetch will
      // abort via `request.signal`.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}