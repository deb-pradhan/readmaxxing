/**
 * /api/positions — cross-device resume-to-exact-word.
 *
 * POST { userId, documentId, wordOffset, speed, lastPlayedAt, updatedAt }
 *   → upsert row in `playback_positions`. Returns the canonical row.
 *
 * GET ?userId=… → all positions for the user + their parent document +
 *   segment tree (so the ContinueShelf on the home page can render
 *   without a second round trip per row).
 *
 * Phase 1 uses the dev `x-dev-user-id` header (see apps/web/middleware.ts).
 * Real Privy lands in Phase 2.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import { isValidPosition, type PlaybackPosition } from "@readmaxxing/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z
  .object({
    userId: z.string(),
    documentId: z.string(),
    wordOffset: z.number().int().nonnegative(),
    speed: z.number().min(0.1).max(10),
    lastPlayedAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  const headerUserId =
    request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }
  if (!headerUserId || headerUserId !== body.userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "userId mismatch." },
      { status: 401 },
    );
  }
  const now = new Date();
  try {
    const row = await db().playbackPosition.upsert({
      where: {
        userId_documentId: { userId: body.userId, documentId: body.documentId },
      },
      create: {
        userId: body.userId,
        documentId: body.documentId,
        wordOffset: body.wordOffset,
        speed: body.speed,
        lastPlayedAt: body.lastPlayedAt ? new Date(body.lastPlayedAt) : now,
        updatedAt: body.updatedAt ? new Date(body.updatedAt) : now,
      },
      update: {
        wordOffset: body.wordOffset,
        speed: body.speed,
        lastPlayedAt: body.lastPlayedAt ? new Date(body.lastPlayedAt) : now,
        updatedAt: now,
      },
    });
    return NextResponse.json({
      userId: row.userId,
      documentId: row.documentId,
      wordOffset: row.wordOffset,
      speed: row.speed,
      lastPlayedAt: row.lastPlayedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } satisfies PlaybackPosition);
  } catch (err) {
    console.error("positions.POST failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't persist position." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const rows = await db().playbackPosition.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            source: true,
            sourceType: true,
            wordCount: true,
            estimatedReadTimeSeconds: true,
            segmentTreeId: true,
            segmentTree: true,
            addedAt: true,
          },
        },
      },
    });
    return NextResponse.json({
      positions: rows.map((row) => ({
        position: {
          userId: row.userId,
          documentId: row.documentId,
          wordOffset: row.wordOffset,
          speed: row.speed,
          lastPlayedAt: row.lastPlayedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        } satisfies PlaybackPosition,
        document: row.document
          ? {
              id: row.document.id,
              segmentTreeId: row.document.segmentTreeId,
              source: row.document.source,
              sourceType: row.document.sourceType,
              title: row.document.title,
              author: null,
              coverUrl: null,
              tags: [],
              sizeBytes: 0,
              addedAt: row.document.addedAt.toISOString(),
              pinned: false,
              archivedAt: null,
            }
          : null,
        tree: row.document?.segmentTree ?? null,
      })),
    });
  } catch (err) {
    console.error("positions.GET failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't list positions." },
      { status: 500 },
    );
  }
}

export const _isValidPosition = isValidPosition; // re-export for tests