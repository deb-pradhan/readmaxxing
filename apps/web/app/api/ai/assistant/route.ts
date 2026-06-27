/**
 * /api/ai/assistant — context-aware assistant chat (Phase 4).
 *
 * Combines Ask-the-doc grounding with optional context from the user's
 * current playback (document + wordOffset) so the assistant can answer
 * "what did I miss?" with a grounded recap and citation.
 *
 * Per TESTING.md §9 emits `assistant.context_attach` when a playback
 * anchor is provided (logs only the offset + duration, never text).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildAskPrompt, validateCitations, type AiMessage } from "@readmaxxing/ai";
import { PrismaClient } from "@readmaxxing/db";
import { loadDocument, loadLastPosition, anchorForWord } from "@/lib/ai/document-loader";
import { dispatchAiStream } from "@/lib/ai/worker-bridge";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z.object({
  /** Optional — bind the assistant to a specific document. */
  documentId: z.string().min(1).max(200).optional(),
  /** Optional — bind to a specific podcast episode. */
  episodeId: z.string().min(1).max(200).optional(),
  /** Optional — the user's current playback word offset. */
  wordOffset: z.number().int().nonnegative().optional(),
  /** Question / message. */
  question: z.string().min(1).max(2_000),
  stream: z.boolean().default(true),
});

interface ScriptLine {
  speaker?: string;
  text?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
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
    task: "ask" as const,
    document_id: body.documentId ?? body.episodeId ?? null,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  // Resolve source text + context block.
  let sourceText = "";
  let contextBlock = "";
  if (body.documentId) {
    const doc = await loadDocument(body.documentId, userId);
    if (!doc) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }
    sourceText = doc.text;
    if (typeof body.wordOffset === "number") {
      const pos = await loadLastPosition(userId, body.documentId);
      const anchor = anchorForWord(doc.tree, body.wordOffset);
      contextBlock = `Listener is currently at paragraph ${anchor.paragraphIndex}, sentence ${anchor.sentenceIndex} (word offset ${body.wordOffset}). Last persisted position updatedAt=${pos?.updatedAt?.toISOString() ?? "unknown"}.`;
    }
  } else if (body.episodeId) {
    const ep = await db().podcastEpisode.findFirst({
      where: { id: body.episodeId, userId },
      select: { id: true, title: true, script: true, status: true },
    });
    if (!ep) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (ep.status !== "completed") {
      return NextResponse.json({ error: "not_ready" }, { status: 409 });
    }
    const script = (ep.script as unknown as ScriptLine[]) ?? [];
    sourceText = script
      .map((line, idx) => `[${idx}] ${line.speaker ?? "H1"}: ${line.text ?? ""}`)
      .join("\n");
    contextBlock = `Episode: ${ep.title}`;
  }

  log.info({
    ...baseFields,
    event: "assistant.context_attach",
    word_offset: body.wordOffset ?? null,
    has_document: Boolean(body.documentId),
    has_episode: Boolean(body.episodeId),
    text_bytes: sourceText.length,
  });

  const systemOverride = [
    "You are ReadMaxxing's voice assistant — concise, warm, and grounded.",
    contextBlock,
    "Answer the listener's question. Cite the source with [cite:p:s] for any non-trivial claim.",
  ]
    .filter(Boolean)
    .join("\n");

  const { system, prompt } = buildAskPrompt({
    documentText: sourceText || "(no source)",
    question: body.question,
    systemOverride,
  });
  const messages: AiMessage[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  if (body.stream) {
    log.info({ ...baseFields, event: "ai.task_start" });
    const encoder = new TextEncoder();
    const start = Date.now();
    let fullText = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (obj: unknown): void => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          } catch {
            /* closed */
          }
        };
        enqueue({ meta: { requestId } });
        try {
          const it = await dispatchAiStream({
            feature: "ask",
            messages,
            userId,
            signal: request.signal,
          });
          for await (const delta of it) {
            fullText += delta;
            enqueue({ delta });
          }
          const validation = validateCitations(fullText);
          if (validation.missing) {
            log.warn({
              ...baseFields,
              event: "ai.citation_missing",
              prose_length: validation.proseLength,
            });
          }
          log.info({
            ...baseFields,
            event: "ai.task_complete",
            duration_ms: Date.now() - start,
            citation_count: validation.count,
          });
          enqueue({
            done: true,
            citations: validation.anchors ?? [],
            model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
          });
        } catch (err) {
          enqueue({
            error: "ai_failed",
            message: (err as Error).message.slice(0, 200),
          });
          log.error({
            ...baseFields,
            event: "ai.task_failed",
            error_class: (err as Error).name,
            error_msg: (err as Error).message.slice(0, 200),
          });
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store, no-transform",
        "X-Request-Id": requestId,
      },
    });
  }

  return NextResponse.json({ error: "non_streaming_unsupported" }, { status: 501 });
}