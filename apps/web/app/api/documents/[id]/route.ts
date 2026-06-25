/**
 * /api/documents/[id] — single document fetch + segment updates.
 *
 * GET → { id, title, source, segmentTree, … }
 * PATCH { segmentTree } → persist an updated segment tree (used when the
 *   python worker later returns a more accurate parse).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PatchBody = z.object({
  segmentTree: z.unknown().optional(),
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const doc = await db().document.findFirst({
      where: { id, userId },
    });
    if (!doc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  } catch (err) {
    console.error("documents/[id].GET failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't fetch document." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }
  try {
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data["title"] = body.title;
    if (body.pinned !== undefined) data["pinned"] = body.pinned;
    if (body.archived !== undefined) data["archivedAt"] = body.archived ? new Date() : null;
    if (body.segmentTree !== undefined) {
      data["segmentTree"] = body.segmentTree;
      const tree = body.segmentTree as { wordCount?: number; estimatedReadTimeSeconds?: number; segmentTreeId?: string };
      if (typeof tree?.wordCount === "number") data["wordCount"] = tree.wordCount;
      if (typeof tree?.estimatedReadTimeSeconds === "number")
        data["estimatedReadTimeSeconds"] = tree.estimatedReadTimeSeconds;
      if (typeof tree?.segmentTreeId === "string") data["segmentTreeId"] = tree.segmentTreeId;
    }
    const doc = await db().document.update({
      where: { id },
      data,
      select: { id: true, title: true, segmentTreeId: true, updatedAt: true },
    });
    return NextResponse.json(doc);
  } catch (err) {
    console.error("documents/[id].PATCH failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't update document." },
      { status: 500 },
    );
  }
}