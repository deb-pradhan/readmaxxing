/**
 * /api/positions/stream — SSE feed of position updates for the authed user.
 *
 * Phase 2 contract (per the v1 detailed plan §10 step 24):
 *   - `event: position-update` whenever a newer position is upserted for
 *     the authed user (since the last frame the client saw).
 *   - 30-second heartbeat to keep proxies from killing the connection.
 *   - Honors `?since=ISO timestamp` — only emit updates strictly newer.
 *   - Honors `request.signal.aborted` so disconnecting tabs close promptly.
 *
 * Phase 1's 1.5s polling is replaced with a 5s loop — tighter than the
 * heartbeat so we still feel snappy without hammering the DB. Postgres
 * LISTEN/NOTIFY replaces this in a follow-up phase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET(request: NextRequest): Promise<Response> {
  const headerUserId =
    request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!headerUserId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId: string = headerUserId;
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastStamp: string = since.toISOString();
      let closed = false;

      const enqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      async function tick(): Promise<void> {
        if (closed) return;
        try {
          const rows = await db().playbackPosition.findMany({
            where: {
              userId,
              updatedAt: { gt: since },
            },
            orderBy: { updatedAt: "asc" },
            take: 25,
            select: {
              userId: true,
              documentId: true,
              wordOffset: true,
              speed: true,
              lastPlayedAt: true,
              updatedAt: true,
            },
          });
          for (const row of rows) {
            const stamp = row.updatedAt.toISOString();
            if (stamp <= lastStamp) continue;
            lastStamp = stamp;
            enqueue(
              `event: position-update\ndata: ${JSON.stringify({
                userId: row.userId,
                documentId: row.documentId,
                wordOffset: row.wordOffset,
                speed: row.speed,
                lastPlayedAt: row.lastPlayedAt.toISOString(),
                updatedAt: stamp,
              })}\n\n`,
            );
          }
        } catch (err) {
          enqueue(
            `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
          );
        }
      }

      enqueue(`: connected at ${new Date().toISOString()}\n\n`);
      void tick();

      const poll = setInterval(() => void tick(), POLL_INTERVAL_MS);
      const heartbeat = setInterval(
        () => enqueue(`: keep-alive ${Date.now()}\n\n`),
        HEARTBEAT_INTERVAL_MS,
      );

      const onAbort = (): void => {
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", onAbort);
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