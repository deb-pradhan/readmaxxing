/**
 * /api/positions/stream — SSE feed of position updates for the authed user.
 *
 * Phase 1: 1.5s polling loop that reads `playback_positions` ordered by
 * `updatedAt` and emits an SSE frame whenever the latest `updatedAt`
 * advances. Phase 2 swaps the loop for Postgres LISTEN/NOTIFY for
 * sub-second updates.
 *
 * The handler honors `request.signal.aborted` so disconnecting tabs
 * close the stream promptly.
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

const POLL_INTERVAL_MS = 1500;

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resolvedUserId: string = userId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastUpdatedAt: string | null = null;
      let closed = false;

      async function tick() {
        if (closed) return;
        try {
          const latest = await db().playbackPosition.findFirst({
            where: { userId: resolvedUserId },
            orderBy: { updatedAt: "desc" },
            select: {
              userId: true,
              documentId: true,
              wordOffset: true,
              speed: true,
              lastPlayedAt: true,
              updatedAt: true,
            },
          });
          const stamp = latest?.updatedAt.toISOString() ?? null;
          if (stamp && stamp !== lastUpdatedAt) {
            lastUpdatedAt = stamp;
            const frame = `event: position\ndata: ${JSON.stringify({
              userId: latest!.userId,
              documentId: latest!.documentId,
              wordOffset: latest!.wordOffset,
              speed: latest!.speed,
              lastPlayedAt: latest!.lastPlayedAt.toISOString(),
              updatedAt: latest!.updatedAt.toISOString(),
            })}\n\n`;
            controller.enqueue(encoder.encode(frame));
          } else {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
            ),
          );
        }
      }

      await tick();
      const interval = setInterval(tick, POLL_INTERVAL_MS);

      const onAbort = () => {
        closed = true;
        clearInterval(interval);
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
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}