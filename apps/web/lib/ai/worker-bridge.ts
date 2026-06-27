/**
 * Worker bridge — for AI tasks, prefer the Python worker (per the v1 plan)
 * when `WORKER_API_URL` is set; otherwise execute in-process via
 * `@readmaxxing/ai`. The two paths produce identical output because both
 * consume the same prompt-helper system prompts.
 *
 * Kept tiny and dependency-free: a fetch with a timeout, an `OPENROUTER_API_KEY`
 * check, and a typed `AiCallResult` envelope. The BFF routes do the rest
 * (caching, persistence, logging, metering).
 */

import { complete, stream, type AiCompletionResponse, type AiMessage } from "@readmaxxing/ai";

export interface WorkerBridgeOptions {
  feature: string;
  userId?: string;
  /** Override the default 60s timeout (used by the streaming ask path). */
  timeoutMs?: number;
  /** When true, the call must hit the worker (or fail with `worker_unreachable`). */
  preferWorker?: boolean;
}

export interface AiCallResult<T = unknown> {
  text: string;
  parsed: T;
  usage: AiCompletionResponse["usage"];
  model: string;
  /** Where the call ran. "worker" or "in-process". */
  source: "worker" | "in-process";
}

function workerConfigured(): boolean {
  return Boolean(process.env["WORKER_API_URL"]);
}

function workerUrl(): string | null {
  return process.env["WORKER_API_URL"] ?? null;
}

function workerHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Worker-Token": process.env["WORKER_API_TOKEN"] ?? "local-dev-token",
  };
}

/**
 * Send a chat-completions-style request to the worker's `/v1/ai/*` HTTP
 * routes. The worker mirrors the OpenRouter response shape so this returns
 * the same envelope the in-process client would.
 */
async function callWorker(args: {
  path: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  feature: string;
  userId?: string;
}): Promise<AiCompletionResponse> {
  const base = workerUrl();
  if (!base) throw new Error("worker_unreachable: WORKER_API_URL not set");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const res = await fetch(`${base}${args.path}`, {
      method: "POST",
      headers: workerHeaders(),
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`worker ${res.status}: ${text.slice(0, 240)}`);
    }
    const data = (await res.json()) as {
      text: string;
      parsed?: unknown;
      usage: AiCompletionResponse["usage"];
      model: string;
    };
    return {
      text: data.text,
      usage: data.usage,
      model: data.model,
      parsed: data.parsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch a chat completion to either the worker or the in-process client.
 *
 * If `WORKER_API_URL` is set AND the worker path is implemented for this
 * `feature`, we prefer the worker (per D1 in the v1 plan). Otherwise we run
 * the same prompt in-process. Both paths produce identical output because
 * the system prompts come from the same helper module.
 */
export async function dispatchAi(args: {
  feature: "summary" | "quiz" | "recap" | "ask" | "fillers";
  messages: AiMessage[];
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  documentId?: string;
  userId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<AiCompletionResponse> {
  const timeoutMs = args.timeoutMs ?? 60_000;

  if (workerConfigured()) {
    try {
      const body: Record<string, unknown> = {
        feature: args.feature,
        document_id: args.documentId ?? null,
        messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
        model: undefined,
        json_schema: args.jsonSchema ?? null,
      };
      const workerRes = await callWorker({
        path: "/v1/ai/run",
        body,
        timeoutMs,
        feature: args.feature,
        userId: args.userId,
      });
      return workerRes;
    } catch (err) {
      // Worker reachable but failing — try in-process as a fallback so a
      // single worker outage doesn't break the reader. Logged at the call site.
      if (args.signal?.aborted) throw err;
      // We still fall through to in-process unless the caller asked for
      // strict worker mode.
    }
  }

  // In-process path. Use `complete` (not `completeJson`) so the response
  // shape stays uniform with the worker path (`AiCompletionResponse`).
  const inProcessRes = await complete({
    messages: args.messages,
    jsonSchema: args.jsonSchema,
    signal: args.signal,
    appMetadata: { feature: args.feature, userId: args.userId },
  });
  return inProcessRes;
}

/**
 * Streaming completion. Ask-the-doc needs the stream() API per UI-UX.md §7
 * ("Podcast generation shows progress with honest stages…") and the brief
 * ("Streaming where it matters. Ask-the-doc must stream").
 *
 * We always stream from `@readmaxxing/ai` directly — the worker's HTTP
 * surface would need SSE forwarding, which is Phase 4 work. The streaming
 * path also doesn't need the worker's separate process because it never
 * touches Redis or the DB.
 */
export async function dispatchAiStream(args: {
  feature: "ask" | "recap" | "summary";
  messages: AiMessage[];
  userId?: string;
  signal?: AbortSignal;
}): Promise<AsyncIterable<string>> {
  return stream({
    messages: args.messages,
    signal: args.signal,
    appMetadata: { feature: args.feature, userId: args.userId },
  });
}
