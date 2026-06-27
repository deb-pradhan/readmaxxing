/**
 * /api/ai/podcasts/[id] — single-episode metadata lookup.
 *
 * Returns the canonical `PodcastEpisode` row plus the parent `Podcast`
 * (style + title). Auth is enforced via `x-user-id`; the route never
 * returns another user's episode.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { readUserId } from "@/lib/observability";

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
): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await db().podcastEpisode.findFirst({
    where: { id: params.id, userId },
    include: {
      podcast: { select: { id: true, style: true, title: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    episode: {
      id: row.id,
      podcastId: row.podcastId,
      title: row.title,
      script: row.script,
      audioPath: row.audioPath,
      durationSeconds: row.durationSeconds,
      status: row.status,
      progress: row.progress,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      podcast: row.podcast,
    },
  });
}