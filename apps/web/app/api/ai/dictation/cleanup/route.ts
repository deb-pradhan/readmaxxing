/**
 * POST /api/ai/dictation/cleanup — Phase 5 dictation grammar cleanup.
 *
 * Takes the raw Web Speech API transcript, runs it through the LLM with a
 * tight grammar-cleanup system prompt, and returns a structured diff so
 * the UI can show *exactly* what changed. Per UI-UX.md §7:
 *
 *   "Dictation cleans grammar/fillers and shows what changed subtly
 *    (diff view) so the user trusts it; never silently rewrites meaning."
 *
 * Contract:
 *   POST { original: string, voiceId?: string }
 *   200  { cleaned: string, diff: DiffOp[] }
 *   400  invalid_request | empty_text
 *   401  unauthorized
 *   502  ai_unreachable
 *   500  ai_failed
 *
 * Privacy: never log the raw transcript. We log `text_bytes` only
 * (TESTING.md §8.7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { complete, type AiMessage } from "@readmaxxing/ai";
import { log, newRequestId, readUserId, timed, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  original: z.string().min(1).max(20_000),
  /** Optional voice name — used purely for telemetry, never sent to the LLM. */
  voiceId: z.string().min(1).max(200).optional(),
});

export interface DiffOp {
  text: string;
  op: "unchanged" | "removed" | "added";
}

interface CleanupResponse {
  cleaned: string;
  diff: DiffOp[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    log.warn({
      event: "dictation.unauthorized",
      request_id: requestId,
      route: "/api/ai/dictation/cleanup",
    });
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
    task: "dictation_cleanup" as const,
    text_bytes: body.original.length,
  };

  // System prompt — the LLM is told to ONLY fix grammar, fillers, and
  // punctuation, and to return JSON with the cleaned text. Critically we
  // do NOT require source-citation tags here (the source is the user's
  // own dictation, not a document).
  const system = [
    "You are a dictation cleanup assistant. You receive a raw voice-to-text",
    "transcript (often with filler words like 'um', 'uh', 'like', and",
    "occasional misrecognitions). Your job is to:",
    "  1) Remove filler words that add no meaning ('um', 'uh', 'like', 'you know').",
    "  2) Fix obvious ASR mistakes (homophones, missing punctuation, run-on sentences).",
    "  3) Preserve the speaker's voice and intent — DO NOT rewrite, paraphrase,",
    "     or change the meaning. DO NOT add information that wasn't spoken.",
    "  4) Preserve casing, names, and technical terms exactly as spoken.",
    "",
    "Output JSON with this exact shape:",
    '  { "cleaned": "the cleaned transcript as a single string" }',
    "Return ONLY the JSON. No markdown, no commentary, no extra fields.",
  ].join("\n");

  const messages: AiMessage[] = [
    { role: "system", content: system },
    { role: "user", content: `RAW TRANSCRIPT:\n---\n${body.original}\n---\n\nReturn the cleaned text as JSON.` },
  ];

  try {
    const result = await timed({
      startEvent: "dictation.task_start",
      endEvent: "dictation.task_complete",
      baseFields,
      fn: () =>
        complete({
          messages,
          model: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "openai/gpt-4o-mini",
          appMetadata: { feature: "dictation_cleanup", userId },
        }),
    });

    const cleaned = extractCleaned(result.text);
    const diff = wordDiff(body.original, cleaned);

    return NextResponse.json<CleanupResponse>({ cleaned, diff });
  } catch (err) {
    log.error({
      ...baseFields,
      event: "dictation.task_failed",
      status: "error",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    const message = (err as Error).message;
    const isUnreachable = /api[_-]?key|openrouter|fetch failed/i.test(message);
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

/**
 * Parse the model's JSON output. Tolerant of markdown fences so a flaky
 * provider doesn't kill the response.
 */
function extractCleaned(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) cleaned = cleaned.slice(firstNewline + 1);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
  }
  try {
    const parsed = JSON.parse(cleaned) as { cleaned?: unknown };
    if (typeof parsed.cleaned === "string") return parsed.cleaned;
  } catch {
    // Fall through — treat the whole text as the cleaned version.
  }
  return cleaned;
}

/**
 * Compute a simple word-level diff between `original` and `cleaned`.
 *
 * Uses the classic longest-common-subsequence (LCS) algorithm at the
 * WORD level — O(n*m) but fine for transcripts (≤ 5k words). For very
 * large inputs we'd swap this for `diff-match-patch`, but the simple
 * approach keeps the contract dependency-free and the tests pure.
 *
 * The output is a flat list of ops in the same order as the cleaned
 * text appears: `unchanged` and `added` ops consume the cleaned side,
 * `removed` ops do not.
 */
export function wordDiff(original: string, cleaned: string): DiffOp[] {
  const a = tokenize(original);
  const b = tokenize(cleaned);

  // Special case: no edits at all.
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ text: cleaned, op: "added" }];
  if (b.length === 0) return [{ text: original, op: "removed" }];

  // Build LCS table.
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Walk back to produce ops.
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ text: a[i - 1]!, op: "unchanged" });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      ops.push({ text: a[i - 1]!, op: "removed" });
      i--;
    } else {
      ops.push({ text: b[j - 1]!, op: "added" });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ text: a[i - 1]!, op: "removed" });
    i--;
  }
  while (j > 0) {
    ops.push({ text: b[j - 1]!, op: "added" });
    j--;
  }
  ops.reverse();
  return mergeAdjacent(ops);
}

function tokenize(s: string): string[] {
  // Split on whitespace; keep the leading whitespace attached to the
  // following word so we can reconstruct spacing on render.
  return s.split(/(\s+)/).filter((tok) => tok.length > 0);
}

function mergeAdjacent(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (last && last.op === op.op) {
      last.text += op.text;
    } else {
      out.push({ ...op });
    }
  }
  return out;
}
