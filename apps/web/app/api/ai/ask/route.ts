/**
 * POST /api/ai/ask — grounded Q&A with streaming (UI-UX.md §7).
 *
 * Streams the assistant's answer as NDJSON: each line is `{ delta: string }`
 * and the last line is `{ done: true, citations: [...], model }`. The first
 * line is `{ meta: { requestId } }` so the client can correlate logs.
 *
 * Non-streaming: callers can pass `{ stream: false }` to get a single JSON
 * response (used by tests + the first-paint experience). Default is streaming.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildAskPrompt, validateCitations, type AiMessage } from "@readmaxxing/ai";
import { recordUsage, loadDocument } from "@/lib/ai/document-loader";
import { dispatchAiStream } from "@/lib/ai/worker-bridge";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  documentId: z.string().min(1).max(200),
  question: z.string().min(1).max(2_000),
  stream: z.boolean().default(true),
});

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
    document_id: body.documentId,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  const doc = await loadDocument(body.documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  const { system, prompt } = buildAskPrompt({
    documentText: doc.text,
    question: body.question,
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
          const stream = await dispatchAiStream({
            feature: "ask",
            messages,
            userId,
            signal: request.signal,
          });
          for await (const delta of stream) {
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
            status: "ok",
            duration_ms: Date.now() - start,
            citation_count: validation.count,
          });
          enqueue({
            done: true,
            citations: validation.anchors,
            model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
          });
          void recordUsage({
            userId,
            action: "ai_ask",
            quantity: Math.max(1, Math.round(fullText.length / 4)),
            provider: "openrouter",
            sourceId: doc.id,
          });
        } catch (err) {
          log.error({
            ...baseFields,
            event: "ai.task_failed",
            status: "error",
            error_class: (err as Error).name,
            error_msg: (err as Error).message.slice(0, 200),
          });
          enqueue({
            done: true,
            error: "ai_unreachable",
            message: "Couldn't reach the assistant — retry in a moment.",
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
        "Cache-Control": "no-store, no-transform",
        "X-Request-Id": requestId,
      },
    });
  }

  // Non-streaming fallback (for tests + curl).
  try {
    const start = Date.now();
    let fullText = "";
    const stream = await dispatchAiStream({
      feature: "ask",
      messages,
      userId,
      signal: request.signal,
    });
    for await (const delta of stream) {
      fullText += delta;
    }
    const validation = validateCitations(fullText);
    log.info({
      ...baseFields,
      event: "ai.task_complete",
      status: "ok",
      duration_ms: Date.now() - start,
      citation_count: validation.count,
    });
    return NextResponse.json({
      answer: fullText,
      citations: validation.anchors,
      model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
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
