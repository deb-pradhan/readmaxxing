/**
 * POST /api/ai/quiz — retrieval-practice quiz (Phase 3).
 *
 * Generates N multiple-choice questions. Persists the quiz + an empty
 * QuizAttempt scaffold (so the client can submit answers in a follow-up
 * call). Returns the quiz in the BFF route contract shape so the UI doesn't
 * need to know the LLM JSON schema.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildQuizPrompt, parseQuiz, type AiMessage } from "@readmaxxing/ai";
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
  count: z.number().int().min(1).max(20).default(5),
});

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
    task: "quiz" as const,
    document_id: body.documentId,
    model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
  };

  const doc = await loadDocument(body.documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  try {
    const { system, prompt, jsonSchema } = buildQuizPrompt({
      documentText: doc.text,
      questionCount: body.count,
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
          feature: "quiz",
          messages,
          jsonSchema,
          userId,
          documentId: doc.id,
        }),
    });

    const parsed = parseQuiz(result.parsed ?? {});
    if (parsed.questions.length === 0) {
      log.warn({
        ...baseFields,
        event: "ai.citation_missing",
        model: result.model,
        reason: "empty_quiz",
      });
    }

    const stored = await db().quiz.create({
      data: {
        userId,
        documentId: doc.id,
        questions: parsed.questions as unknown as object,
      },
    });

    void recordUsage({
      userId,
      action: "ai_quiz",
      quantity: result.usage.inputTokens + result.usage.outputTokens,
      provider: result.usage.provider ?? "openrouter",
      sourceId: stored.id,
    });

    return NextResponse.json(
      {
        quizId: stored.id,
        questions: parsed.questions,
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
    return NextResponse.json(
      {
        error: "ai_unreachable",
        message: "Couldn't reach the assistant — retry in a moment.",
      },
      { status: 502 },
    );
  }
}

/**
 * POST /api/ai/quiz/attempt — submit answers for an existing quiz.
 *
 * Body: { quizId, answers: number[] (one per question), durationMs }
 * Persists a QuizAttempt row and returns the score.
 */
const AttemptBody = z.object({
  quizId: z.string().min(1),
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(20),
  durationMs: z.number().int().nonnegative().default(0),
});

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof AttemptBody>;
  try {
    body = AttemptBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }
  const quiz = await db().quiz.findFirst({
    where: { id: body.quizId, userId },
    select: { id: true, questions: true },
  });
  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }
  const questions = quiz.questions as Array<{ correctIndex: number }>;
  const score = questions.reduce(
    (acc, q, i) => acc + (q.correctIndex === body.answers[i] ? 1 : 0),
    0,
  );
  const stored = await db().quizAttempt.create({
    data: {
      userId,
      quizId: quiz.id,
      answers: body.answers as unknown as object,
      score,
      total: questions.length,
      durationMs: body.durationMs,
    },
  });
  return NextResponse.json({
    attemptId: stored.id,
    score,
    total: questions.length,
    percent: Math.round((score / Math.max(1, questions.length)) * 100),
  });
}
