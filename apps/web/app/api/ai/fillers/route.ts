/**
 * POST /api/ai/fillers — detect skippable "filler" sentences (UI-UX.md §7).
 *
 * Returns paragraph/sentence anchors the player can auto-skip. Results are
 * stored in `Document.fillerSegments` (Int[] of flattened (paragraph*1000 +
 * sentence) ids) so we can read them from the client without re-running the
 * LLM.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildFillerPrompt, parseFillerResult, type AiMessage } from "@readmaxxing/ai";
import { PrismaClient } from "@readmaxxing/db";
import { loadDocument, recordUsage } from "@/lib/ai/document-loader";
import { dispatchAi } from "@/lib/ai/worker-bridge";
import { log, newRequestId, readUserId, timed, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z.object({
  documentId: z.string().min(1).max(200),
  force: z.boolean().default(false),
});

function anchorToFlatId(paragraphIndex: number, sentenceIndex: number): number {
  return paragraphIndex * 1000 + sentenceIndex;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
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

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    task: "fillers" as const,
    document_id: body.documentId,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  const doc = await loadDocument(body.documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  if (!body.force) {
    try {
      const stored = await db().$queryRawUnsafe<Array<{ fillerSegments: number[] | null }>>(
        `SELECT "fillerSegments" FROM "Document" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
        doc.id,
        userId,
      );
      const segments = stored[0]?.fillerSegments;
      if (Array.isArray(segments) && segments.length > 0) {
        return NextResponse.json({
          fillers: segments,
          count: segments.length,
          cached: true,
        });
      }
    } catch {
      // column may not exist yet in dev DB — fall through to the model call.
    }
  }

  try {
    const { system, prompt, jsonSchema } = buildFillerPrompt({
      documentText: doc.text,
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
          feature: "fillers",
          messages,
          jsonSchema,
          userId,
          documentId: doc.id,
        }),
    });

    const parsed = parseFillerResult(result.parsed ?? {});
    const flat = parsed.map((f) => anchorToFlatId(f.paragraphIndex, f.sentenceIndex));

    try {
      await db().$executeRawUnsafe(
        `UPDATE "Document" SET "fillerSegments" = $1::int[] WHERE "id" = $2`,
        `{${flat.join(",")}}`,
        doc.id,
      );
    } catch {
      // column may not exist yet — we still return the result to the client.
    }

    void recordUsage({
      userId,
      action: "filler_detect",
      quantity: result.usage.inputTokens + result.usage.outputTokens,
      provider: result.usage.provider ?? "openrouter",
      sourceId: doc.id,
    });

    return NextResponse.json({
      fillers: flat,
      reasons: parsed,
      count: flat.length,
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
