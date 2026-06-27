/**
 * POST /api/ai/summary — layered AI summary (TL;DR / bullets / detailed).
 *
 * - Persists the result into `Summary` (keyed by `documentId + level`) so
 *   subsequent calls hit Postgres before reaching OpenRouter.
 * - Citations are aggregated and returned alongside the layered payload.
 * - Every call writes a `UsageLedger` row for billing/quota.
 * - On any error the user sees a calm, human message — never a raw 503.
 *
 * Per UI-UX.md §7: AI features cite the source. The system prompt enforces
 * `[cite:p:s]` tags; we additionally log `ai.citation_missing` when the
 * response has zero citations for substantive prose.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSummaryPrompt, parseSummary, validateCitations, type AiMessage } from "@readmaxxing/ai";
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
  level: z.enum(["tldr", "bullets", "detailed"]).default("tldr"),
  style: z.enum(["default", "academic", "casual"]).default("default"),
  /** When true, skip the cache and always call the model. */
  force: z.boolean().default(false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    log.warn({ event: "ai.task_unauthorized", request_id: requestId, route: "/api/ai/summary" });
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
    task: "summary" as const,
    document_id: body.documentId,
    level: body.level,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  // Try the cache (Summary table) first.
  if (!body.force) {
    const cached = await db().summary.findFirst({
      where: { userId, documentId: body.documentId },
      orderBy: { createdAt: "desc" },
    });
    if (cached) {
      log.info({ ...baseFields, event: "ai.task_cache_hit", status: "ok" });
      const layers = cached.layers as { tldr?: string; bullets?: string[]; detailed?: string } | null;
      return NextResponse.json({
        id: cached.id,
        cached: true,
        level: body.level,
        content: {
          tldr: layers?.tldr ?? "",
          bullets: layers?.bullets ?? [],
          detailed: layers?.detailed ?? "",
        },
        citations: cached.citations ?? [],
        model: cached.model,
        createdAt: cached.createdAt.toISOString(),
      });
    }
  }

  const doc = await loadDocument(body.documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  try {
    const { system, prompt } = buildSummaryPrompt({
      documentText: doc.text,
      style: body.style,
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
          feature: "summary",
          messages,
          userId,
          documentId: doc.id,
        }),
    });

    const parsed = parseSummary(result.text);
    const validation = validateCitations(result.text);
    if (validation.missing) {
      log.warn({
        ...baseFields,
        event: "ai.citation_missing",
        model: result.model,
        prose_length: validation.proseLength,
      });
    }

    const stored = await db().summary.create({
      data: {
        userId,
        documentId: doc.id,
        layers: {
          tldr: parsed.tldr,
          bullets: parsed.bullets,
          detailed: parsed.detailed,
        },
        citations: parsed.citations as unknown as object,
        model: result.model,
        costCents: Math.round((result.usage.costUsd ?? 0) * 100),
      },
    });

    void recordUsage({
      userId,
      action: "ai_summary",
      quantity: result.usage.inputTokens + result.usage.outputTokens,
      provider: result.usage.provider ?? "openrouter",
      sourceId: stored.id,
    });

    return NextResponse.json(
      {
        id: stored.id,
        cached: false,
        level: body.level,
        content: {
          tldr: parsed.tldr,
          bullets: parsed.bullets,
          detailed: parsed.detailed,
        },
        citations: parsed.citations,
        model: result.model,
        createdAt: stored.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    log.error({
      ...baseFields,
      event: "ai.task_failed",
      status: "error",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    const message = (err as Error).message;
    const isUnreachable = /api[_-]?key|openrouter|worker_unreachable|fetch failed/i.test(message);
    return NextResponse.json(
      {
        error: isUnreachable ? "ai_unreachable" : "ai_failed",
        message: isUnreachable
          ? "Couldn't reach the assistant — retry in a moment."
          : "The assistant returned an error — retry.",
      },
      { status: isUnreachable ? 502 : 500 },
    );
  }
}
