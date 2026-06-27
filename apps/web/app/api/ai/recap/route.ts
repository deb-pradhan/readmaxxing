/**
 * GET /api/ai/recap?documentId=… — short, specific "pick up where you left off"
 * recap (UI-UX.md §6 / §7). Cached by `(userId, documentId, lastUpdatedAt)`
 * so re-renders are instant; the cache is invalidated automatically when
 * the user's last position changes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { buildRecapPrompt, type AiMessage } from "@readmaxxing/ai";
import { anchorForWord, loadDocument, loadLastPosition, recordUsage } from "@/lib/ai/document-loader";
import { dispatchAi } from "@/lib/ai/worker-bridge";
import { log, newRequestId, readUserId, timed, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface RecapCacheRow {
  id: string;
  userId: string;
  documentId: string;
  anchorWordOffset: number;
  text: string;
  createdAt: Date;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json(
      { error: "invalid_request", message: "documentId is required" },
      { status: 400 },
    );
  }

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    task: "recap" as const,
    document_id: documentId,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  const doc = await loadDocument(documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  const position = await loadLastPosition(userId, documentId);
  if (!position) {
    return NextResponse.json({
      recap: null,
      generatedAt: null,
      reason: "no_position",
    });
  }

  // Cache hit if a recent recap exists for the same position.
  try {
    const cache = await db().$queryRawUnsafe<RecapCacheRow[]>(
      `SELECT id, "userId", "documentId", "anchorWordOffset", text, "createdAt"
       FROM "RecapCache"
       WHERE "userId" = $1 AND "documentId" = $2 AND "anchorWordOffset" = $3
       ORDER BY "createdAt" DESC LIMIT 1`,
      userId,
      documentId,
      position.wordOffset,
    );
    const row = cache[0];
    if (row && Date.now() - row.createdAt.getTime() < CACHE_TTL_MS) {
      log.info({ ...baseFields, event: "ai.task_cache_hit", status: "ok" });
      return NextResponse.json({
        recap: row.text,
        generatedAt: row.createdAt.toISOString(),
        cached: true,
      });
    }
  } catch {
    // RecapCache table may not exist yet (pre-migration). Fall through.
  }

  try {
    const anchor = anchorForWord(doc.tree, position.wordOffset);
    const { system, prompt } = buildRecapPrompt({
      documentText: doc.text,
      lastParagraphIndex: anchor.paragraphIndex,
      lastSentenceIndex: anchor.sentenceIndex,
    });
    const messages: AiMessage[] = [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ];
    const result = await timed({
      startEvent: "ai.task_start",
      endEvent: "ai.task_complete",
      baseFields,
      fn: async () =>
        dispatchAi({
          feature: "recap",
          messages,
          userId,
          documentId: doc.id,
        }),
    });
    const recap = (result.text ?? "").trim().slice(0, 600);

    try {
      await db().$executeRawUnsafe(
        `INSERT INTO "RecapCache" (id, "userId", "documentId", "anchorWordOffset", text, "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        cryptoRandomId(),
        userId,
        documentId,
        position.wordOffset,
        recap,
      );
    } catch {
      // Schema not migrated yet — non-fatal.
    }

    void recordUsage({
      userId,
      action: "ai_recap",
      quantity: result.usage.inputTokens + result.usage.outputTokens,
      provider: result.usage.provider ?? "openrouter",
      sourceId: documentId,
    });

    return NextResponse.json({
      recap,
      generatedAt: new Date().toISOString(),
      anchor,
      cached: false,
    });
  } catch (err) {
    log.error({
      ...baseFields,
      event: "ai.task_failed",
      status: "error",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    return NextResponse.json(
      {
        error: "ai_unreachable",
        message: "Couldn't reach the assistant — retry in a moment.",
      },
      { status: 502 },
    );
  }
}

function cryptoRandomId(): string {
  // 12-byte base36 id is enough for a per-doc cache row.
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}
