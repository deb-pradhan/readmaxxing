/**
 * /api/documents — create / list documents.
 *
 * POST { title, text, voiceId, speed } → { id, segmentTree, … }
 * GET ?userId=… → list of documents the user owns.
 *
 * Phase 1 stores the parsed segment tree as JSON in `Document.segmentTree`
 * (matching the Prisma schema). Real audio synthesis is deferred — the
 * route only persists the parsed document + the *requested* voice/speed;
 * the player synthesizes on first play.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import { buildSegmentTree, type DocumentSourceType } from "@readmaxxing/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z.object({
  title: z.string().min(1).max(200),
  text: z.string().min(1).max(2_000_000),
  sourceType: z
    .enum(["pdf", "docx", "md", "epub", "txt", "url", "paste"])
    .default("paste"),
  source: z.string().optional(),
  language: z.string().default("en"),
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

  const tree = buildSegmentTree(body.text, { documentId: "pending", language: body.language });
  const sourceType = body.sourceType as DocumentSourceType;

  try {
    // Upsert the user (dev auth — real Privy lands in Phase 2).
    await db().user.upsert({
      where: { id: userId },
      create: { id: userId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });

    const doc = await db().document.create({
      data: {
        userId,
        title: body.title,
        source: body.source ?? "pasted",
        sourceType,
        language: body.language,
        segmentTreeId: tree.segmentTreeId,
        segmentTree: tree as unknown as object,
        wordCount: tree.wordCount,
        estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
      },
      select: { id: true, addedAt: true },
    });

    return NextResponse.json(
      {
        id: doc.id,
        title: body.title,
        segmentTreeId: tree.segmentTreeId,
        wordCount: tree.wordCount,
        estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
        addedAt: doc.addedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("documents.POST failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't persist the document." },
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
    const docs = await db().document.findMany({
      where: { userId, archivedAt: null },
      orderBy: { addedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        source: true,
        sourceType: true,
        wordCount: true,
        estimatedReadTimeSeconds: true,
        addedAt: true,
        segmentTreeId: true,
      },
    });
    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error("documents.GET failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't list documents." },
      { status: 500 },
    );
  }
}