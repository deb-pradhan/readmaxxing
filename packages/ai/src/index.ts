/**
 * @readmaxxing/ai — LLM client + prompt helpers, routed through OpenRouter.
 *
 * OpenRouter (https://openrouter.ai/) gives us a single API key to reach any
 * provider — OpenAI, Anthropic, Google, Meta, Mistral, etc. — with automatic
 * fallback. We talk to it via plain `fetch` so the package has no SDK
 * dependency, which keeps the bundle small and the worker deployment simple.
 *
 * Endpoint reference: https://openrouter.ai/docs/api-reference/overview
 *
 * Usage:
 *
 *   import { complete, stream, AiModel } from "@readmaxxing/ai";
 *
 *   const res = await complete({
 *     prompt: "Summarize the following …",
 *     model: "openai/gpt-4o-mini",
 *   });
 *
 *   for await (const delta of stream({ prompt: "…", model: "anthropic/claude-3-5-sonnet" })) {
 *     process.stdout.write(delta);
 *   }
 *
 * Per docs/UI-UX.md §7, AI features must always cite source segments and never
 * silently rewrite meaning — prompt helpers in this package enforce that.
 */

export type AiModel = string;

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiCompletionRequest {
  /** Optional system prompt. */
  system?: string;
  /** Single-turn prompt (alternative to `messages`). */
  prompt?: string;
  /** Multi-turn conversation (takes precedence over `prompt`/`system`). */
  messages?: AiMessage[];
  /** OpenRouter model id, e.g. "openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet". */
  model?: AiModel;
  /** 0 – 2; lower = more deterministic. */
  temperature?: number;
  /** Cap on output tokens. */
  maxTokens?: number;
  /** When true, returns a streaming async iterable of text deltas. */
  stream?: boolean;
  /**
   * When provided, the response is requested as JSON conforming to this schema
   * (passed through to OpenRouter's `response_format.json_schema`). Set
   * `strict: true` for guaranteed-conformance responses.
   */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  /** Optional app-specific tags forwarded as OpenRouter request headers. */
  appMetadata?: {
    /** Logical feature tag (e.g. "summary", "quiz", "podcast"). */
    feature?: string;
    /** User id, for cost attribution / abuse prevention. */
    userId?: string;
  };
  /** Optional AbortSignal to cancel in-flight requests. */
  signal?: AbortSignal;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** USD cost reported by OpenRouter (0 if not returned). */
  costUsd: number;
  /** OpenRouter's normalized provider name (e.g. "OpenAI", "Anthropic"). */
  provider?: string;
}

export interface AiCompletionResponse {
  text: string;
  model: string;
  usage: AiUsage;
  /** Optional parsed JSON if `jsonSchema` was provided. */
  parsed?: unknown;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL: AiModel = "openai/gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;

interface OpenRouterResponseShape {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  /** Provider surfaced by OpenRouter's `provider` field when `route` is on. */
  provider?: string;
}

interface OpenRouterStreamChunk {
  id?: string;
  model?: string;
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  provider?: string;
}

function getApiKey(): string {
  const key =
    typeof process !== "undefined" && process.env
      ? process.env.OPENROUTER_API_KEY ?? ""
      : "";
  if (!key) {
    throw new Error(
      "@readmaxxing/ai: OPENROUTER_API_KEY is not set. Add it to .env (see README).",
    );
  }
  return key;
}

function buildMessages(req: AiCompletionRequest): AiMessage[] {
  if (req.messages && req.messages.length > 0) return req.messages;
  const out: AiMessage[] = [];
  if (req.system) out.push({ role: "system", content: req.system });
  if (req.prompt) out.push({ role: "user", content: req.prompt });
  if (out.length === 0) {
    throw new Error("@readmaxxing/ai: provide either `messages`, `prompt`, or `system`+`prompt`.");
  }
  return out;
}

function buildHeaders(apiKey: string, req: AiCompletionRequest): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  // OpenRouter optional headers — safe to include; many are stripped by CORS.
  if (typeof process !== "undefined" && process.env) {
    const referer =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.OPENROUTER_REFERER ??
      "https://readmaxxing.app";
    const title = process.env.OPENROUTER_APP_TITLE ?? "ReadMaxxing";
    headers.set("HTTP-Referer", referer);
    headers.set("X-Title", title);
  } else {
    headers.set("HTTP-Referer", "https://readmaxxing.app");
    headers.set("X-Title", "ReadMaxxing");
  }
  // Forward a feature tag as a custom header so we can debug in the OpenRouter dashboard.
  if (req.appMetadata?.feature) {
    headers.set("X-Readmaxxing-Feature", req.appMetadata.feature);
  }
  return headers;
}

function buildBody(req: AiCompletionRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model ?? DEFAULT_MODEL,
    messages: buildMessages(req).map((m) => ({ role: m.role, content: m.content })),
    stream: Boolean(req.stream),
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: req.jsonSchema.name,
        schema: req.jsonSchema.schema,
        strict: req.jsonSchema.strict ?? true,
      },
    };
  }
  return body;
}

function extractUsage(payload: OpenRouterResponseShape): AiUsage {
  const u = payload.usage ?? {};
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    costUsd: typeof u.cost === "number" ? u.cost : 0,
    provider: payload.provider,
  };
}

async function requestOpenRouter(
  req: AiCompletionRequest,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const signal = req.signal ?? controller.signal;

  try {
    return await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(apiKey, req),
      body: JSON.stringify(body),
      signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string; code?: number } };
    if (data.error?.message) return data.error.message;
    return JSON.stringify(data);
  } catch {
    return `OpenRouter responded ${res.status} ${res.statusText}`;
  }
}

/**
 * Non-streaming completion. Returns the final assistant text + usage info.
 * Use for summaries, quizzes, podcast scripts, and any AI call where you need
 * the entire response before continuing.
 */
export async function complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
  const apiKey = getApiKey();
  const body = buildBody({ ...req, stream: false });

  const res = await requestOpenRouter(req, apiKey, body);
  if (!res.ok || !res.body) {
    throw new Error(`@readmaxxing/ai: ${await readError(res)}`);
  }

  const payload = (await res.json()) as OpenRouterResponseShape;
  const choice = payload.choices?.[0];
  const text = choice?.message?.content ?? "";
  const out: AiCompletionResponse = {
    text,
    model: payload.model ?? req.model ?? DEFAULT_MODEL,
    usage: extractUsage(payload),
  };
  if (req.jsonSchema) {
    try {
      out.parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      // Some providers return JSON wrapped in fences; strip before parse.
      const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      out.parsed = cleaned.length > 0 ? JSON.parse(cleaned) : null;
    }
  }
  return out;
}

/**
 * Streaming completion. Yields decoded text deltas as they arrive from
 * OpenRouter's SSE stream. Token usage is reported on the final chunk that
 * carries the `usage` field — caller can either ignore it (most apps) or
 * accumulate it themselves.
 *
 * Usage:
 *
 *   for await (const delta of stream({ prompt, model })) {
 *     process.stdout.write(delta);
 *   }
 */
export async function* stream(req: AiCompletionRequest): AsyncIterable<string> {
  const apiKey = getApiKey();
  const body = buildBody({ ...req, stream: true });

  const res = await requestOpenRouter(req, apiKey, body);
  if (!res.ok || !res.body) {
    throw new Error(`@readmaxxing/ai: ${await readError(res)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: events separated by \n\n, lines starting with "data: ".
      let sepIndex = buffer.indexOf("\n\n");
      while (sepIndex !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        const data = dataLines.join("\n").trim();
        if (!data || data === "[DONE]") {
          sepIndex = buffer.indexOf("\n\n");
          continue;
        }
        try {
          const chunk = JSON.parse(data) as OpenRouterStreamChunk;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Tolerate malformed chunks from upstream; keep streaming.
        }
        sepIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Convenience helper for JSON-schema structured outputs without streaming.
 * Returns the parsed object + usage info.
 */
export async function completeJson<T = unknown>(req: AiCompletionRequest): Promise<{
  parsed: T;
  text: string;
  usage: AiUsage;
}> {
  if (!req.jsonSchema) {
    throw new Error("@readmaxxing/ai: completeJson requires `jsonSchema`.");
  }
  const out = await complete(req);
  if (out.parsed === undefined || out.parsed === null) {
    throw new Error("@readmaxxing/ai: response did not contain parseable JSON.");
  }
  return { parsed: out.parsed as T, text: out.text, usage: out.usage };
}

// =============================================================================
// Prompt helpers — these enforce the source-citation + honesty rules from
// docs/UI-UX.md §7 (AI features are servants, not stars; always cite the
// source segment; never silently rewrite meaning).
// =============================================================================

const CITE_RULE = `
Every factual claim must cite the source segment using a citation tag of the
form [cite:paragraphIndex:sentenceIndex] (zero-indexed). If a claim is not
supported by the source, omit it. Never invent citations. Output MUST contain
at least one [cite:p:s] tag per non-trivial claim; "common knowledge" still
needs a citation in this app — trust > fluency (UI-UX.md §7).
`.trim();

/** Regex matching a single citation tag emitted by the model. */
export const CITE_RE = /\[cite:(\d+):(\d+)\]/g;

/** Count citation tags in a model response (text or parsed JSON string field). */
export function countCitations(text: string): number {
  if (!text) return 0;
  return (text.match(CITE_RE) ?? []).length;
}

/**
 * Validate that a model response contains citations. Returns a structured
 * result so callers can decide whether to render, retry, or surface an
 * `ai.citation_missing` event. Non-fatal — empty is allowed for small talk
 * ("hi") but a warning is emitted when prose > 40 chars has no citations.
 */
export interface CitationValidation {
  ok: boolean;
  count: number;
  anchors: Array<{ paragraphIndex: number; sentenceIndex: number }>;
  /** Prose length (text without citation tags and whitespace). */
  proseLength: number;
  /** True if the prose looks substantive (>40 chars) but had zero citations. */
  missing: boolean;
}

export function validateCitations(text: string): CitationValidation {
  if (!text) {
    return { ok: true, count: 0, anchors: [], proseLength: 0, missing: false };
  }
  const matches = [...text.matchAll(new RegExp(CITE_RE.source, "g"))];
  const anchors = matches.map((m) => ({
    paragraphIndex: Number(m[1]),
    sentenceIndex: Number(m[2]),
  }));
  const prose = text.replace(CITE_RE, "").replace(/\s+/g, " ").trim();
  const count = anchors.length;
  const missing = prose.length > 40 && count === 0;
  return {
    ok: !missing,
    count,
    anchors,
    proseLength: prose.length,
    missing,
  };
}

/**
 * Result shape returned to clients when the server has already computed
 * everything the chat UI needs to render an answer: a citations array and
 * the prose string with `[cite:p:s]` placeholders still in place (so the
 * client can tokenize them into CitationPills, audit C4).
 */
export interface RenderedCitations {
  /** Stable list of citation anchors in source order. */
  citations: Array<{ paragraphIndex: number; sentenceIndex: number }>;
  /**
   * Plain text with `[cite:p:s]` placeholders preserved verbatim. The chat
   * client is expected to tokenize this string against the same `CITE_RE`
   * and emit `<CitationPill>` instances for each match.
   */
  prose: string;
}

/**
 * Validate citations AND return the prose string the chat UI will render.
 * This is the canonical Phase C helper — the route calls it once on the
 * accumulated stream and the response body includes both `citations` and
 * `prose` so the client never has to look at raw model output (audit C4).
 */
export function renderCitations(text: string): RenderedCitations {
  const validation = validateCitations(text);
  return {
    citations: validation.anchors,
    prose: text ?? "",
  };
}

/** Build a layered summary prompt (TL;DR → bullets → detailed). */
export function buildSummaryPrompt(args: {
  documentText: string;
  style?: "default" | "academic" | "casual";
}): { system: string; prompt: string } {
  const style = args.style ?? "default";
  return {
    system:
      `You are ReadMaxxing's summarizer. Produce a layered summary:\n` +
      `1) TL;DR — one sentence, ≤ 25 words.\n` +
      `2) Key points — 3 to 6 bullets, each ≤ 25 words.\n` +
      `3) Detailed — a short paragraph (≤ 120 words) for users who want more.\n` +
      `Style: ${style}.\n${CITE_RULE}`,
    prompt: `SOURCE DOCUMENT:\n---\n${args.documentText}\n---\n\nReturn the summary.`,
  };
}

/** Build a retrieval-practice quiz prompt (UI-UX.md §7). */
export function buildQuizPrompt(args: {
  documentText: string;
  questionCount?: number;
}): {
  system: string;
  prompt: string;
  jsonSchema: { name: string; schema: Record<string, unknown>; strict: true };
} {
  const n = args.questionCount ?? 5;
  return {
    system:
      `You write retrieval-practice quizzes. Generate ${n} multiple-choice ` +
      `questions that test recall of important facts from the document. Each ` +
      `question must have exactly 4 choices and one correct answer. Frame the ` +
      `questions as "test yourself" — never trick questions. Cite the source ` +
      `segment for each answer.\n${CITE_RULE}`,
    prompt: `SOURCE DOCUMENT:\n---\n${args.documentText}\n---\n\nReturn the quiz.`,
    jsonSchema: {
      name: "quiz",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          questions: {
            type: "array",
            minItems: n,
            maxItems: n,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string" },
                choices: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: { type: "string" },
                },
                answerIndex: { type: "integer", minimum: 0, maximum: 3 },
                citation: { type: "string" },
              },
              required: ["prompt", "choices", "answerIndex", "citation"],
            },
          },
        },
        required: ["questions"],
      },
    },
  };
}

/** Build a "pick up where you left off" recap prompt (Zeigarnik effect). */
export function buildRecapPrompt(args: {
  documentText: string;
  lastParagraphIndex: number;
  lastSentenceIndex: number;
}): { system: string; prompt: string } {
  return {
    system:
      `You write short, specific recaps so a returning reader knows exactly ` +
      `where they left off and what comes next. Recap must be ≤ 2 sentences, ` +
      `≤ 50 words total. Never invent details not in the source.\n${CITE_RULE}`,
    prompt:
      `The reader stopped at paragraph ${args.lastParagraphIndex}, ` +
      `sentence ${args.lastSentenceIndex}.\n\n` +
      `SOURCE DOCUMENT (truncated to the next ~500 chars after that anchor):\n` +
      `---\n${args.documentText}\n---\n\nWrite the recap.`,
  };
}

/** Build a "ask the document" prompt (grounded Q&A). */
export function buildAskPrompt(args: {
  documentText: string;
  question: string;
  /**
   * Optional full system-prompt override — used by the podcast "talk with
   * the hosts" endpoint so we can re-frame the assistant as one of the
   * hosts without losing the citation rule. When provided, this string
   * is used as the system prompt verbatim; the citation rule is appended.
   */
  systemOverride?: string;
}): { system: string; prompt: string } {
  const baseSystem = args.systemOverride
    ? args.systemOverride
    : `You answer questions about a single document. You may only use facts ` +
      `present in the source. If the source does not contain the answer, say ` +
      `"The document does not address that." Never invent.`;
  return {
    system: `${baseSystem}\n${CITE_RULE}`,
    prompt:
      `QUESTION: ${args.question}\n\n` +
      `SOURCE DOCUMENT:\n---\n${args.documentText}\n---\n\nAnswer the question.`,
  };
}

/** Build a filler-detection prompt (UI-UX.md §7 — "Skip filler content"). */
export function buildFillerPrompt(args: {
  documentText: string;
}): {
  system: string;
  prompt: string;
  jsonSchema: { name: string; schema: Record<string, unknown>; strict: true };
} {
  return {
    system:
      `You identify low-information "filler" sentences (transitions, ` +
      `re-statements, throat-clearing) that a reader/listener could safely ` +
      `skip without losing meaning. Output is a list of paragraphIndex/` +
      `sentenceIndex pairs that are skippable.\n${CITE_RULE}`,
    prompt:
      `SOURCE DOCUMENT:\n---\n${args.documentText}\n---\n\n` +
      `Return the list of skippable sentence anchors.`,
    jsonSchema: {
      name: "fillers",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          fillers: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                paragraphIndex: { type: "integer", minimum: 0 },
                sentenceIndex: { type: "integer", minimum: 0 },
                reason: { type: "string" },
              },
              required: ["paragraphIndex", "sentenceIndex", "reason"],
            },
          },
        },
        required: ["fillers"],
      },
    },
  };
}

// =============================================================================
// Response parsers — turn raw model output into the route contract shapes.
// =============================================================================

export interface ParsedSummary {
  tldr: string;
  bullets: string[];
  detailed: string;
  citations: Array<{ paragraphIndex: number; sentenceIndex: number }>;
}

/**
 * Parse the layered summary text into `{ tldr, bullets, detailed }`.
 *
 * The model is told to emit three sections headed "TL;DR", "Key points", and
 * "Detailed" — but providers occasionally drift. This parser is permissive:
 * if a section is missing it falls back to an empty string, and citation
 * tags from any section are aggregated.
 */
export function parseSummary(text: string): ParsedSummary {
  if (!text) return { tldr: "", bullets: [], detailed: "", citations: [] };
  const stripped = text
    .replace(/^```(?:markdown|md|text)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const sections: Record<"tldr" | "bullets" | "detailed", string> = {
    tldr: "",
    bullets: "",
    detailed: "",
  };

  const tldrMatch = stripped.match(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:TL;?DR|TLDR|One[- ]liner|Headline)\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:#{1,6}\s*)?(?:Key\s*points?|Bullets?|Highlights?|Detailed|Summary|Long)\b|$)/i,
  );
  if (tldrMatch) sections.tldr = tldrMatch[1]!.trim();

  const bulletsMatch = stripped.match(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Key\s*points?|Bullets?|Highlights?)\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:#{1,6}\s*)?(?:Detailed|Long|More|Full)\b|$)/i,
  );
  if (bulletsMatch) sections.bullets = bulletsMatch[1]!.trim();

  const detailedMatch = stripped.match(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Detailed|Long|Summary|Full|More)\s*[:\-]?\s*([\s\S]*?)$/i,
  );
  if (detailedMatch) sections.detailed = detailedMatch[1]!.trim();

  if (!sections.tldr && !sections.bullets && !sections.detailed) {
    sections.tldr = stripped;
  }

  const bullets = sections.bullets
    .split(/\n\s*[-*•]\s+|\n\s*\d+\.\s+|(?:^|\s)[-*•]\s+|(?:^|\s)\d+\.\s+/g)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);

  const citations = [...stripped.matchAll(new RegExp(CITE_RE.source, "g"))].map(
    (m) => ({ paragraphIndex: Number(m[1]), sentenceIndex: Number(m[2]) }),
  );

  return {
    tldr: collapseWhitespace(sections.tldr),
    bullets: bullets.map(collapseWhitespace),
    detailed: collapseWhitespace(sections.detailed),
    citations,
  };
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export interface ParsedFiller {
  paragraphIndex: number;
  sentenceIndex: number;
  reason: string;
}

/** Validate + normalize a filler-detection result. Drops invalid anchors. */
export function parseFillerResult(parsed: unknown): ParsedFiller[] {
  if (!parsed || typeof parsed !== "object") return [];
  const fillers = (parsed as { fillers?: unknown }).fillers;
  if (!Array.isArray(fillers)) return [];
  const out: ParsedFiller[] = [];
  for (const f of fillers) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    if (
      typeof o["paragraphIndex"] === "number" &&
      typeof o["sentenceIndex"] === "number" &&
      typeof o["reason"] === "string"
    ) {
      out.push({
        paragraphIndex: o["paragraphIndex"],
        sentenceIndex: o["sentenceIndex"],
        reason: o["reason"],
      });
    }
  }
  return out;
}

export interface ParsedQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceParagraph: number;
}

export interface ParsedQuiz {
  questions: ParsedQuizQuestion[];
}

/**
 * Map the prompt-helper's quiz JSON shape (`{ prompt, choices, answerIndex, citation }`)
 * to the BFF route contract (`{ question, options, correctIndex, explanation, sourceParagraph }`).
 * The model is told to put a one-sentence reason into the `citation` field; we
 * split that into the `explanation` (text before any `[cite:p:s]` tag) and
 * the `sourceParagraph` (the first `p` we find).
 */
export function parseQuiz(parsed: unknown): ParsedQuiz {
  if (!parsed || typeof parsed !== "object") return { questions: [] };
  const raw = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(raw)) return { questions: [] };
  const out: ParsedQuizQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const prompt = typeof o["prompt"] === "string" ? o["prompt"] : "";
    const choicesRaw = o["choices"];
    const options = Array.isArray(choicesRaw)
      ? choicesRaw.filter((c): c is string => typeof c === "string")
      : [];
    const answerIndex = typeof o["answerIndex"] === "number" ? o["answerIndex"] : 0;
    const citationText = typeof o["citation"] === "string" ? o["citation"] : "";

    const citeMatch = citationText.match(/\[cite:(\d+):\d+\]/);
    const sourceParagraph = citeMatch ? Number(citeMatch[1]) : -1;
    const explanation = citationText.replace(CITE_RE, "").replace(/\s+/g, " ").trim();

    if (prompt && options.length === 4 && answerIndex >= 0 && answerIndex < 4) {
      out.push({
        question: prompt,
        options,
        correctIndex: answerIndex,
        explanation,
        sourceParagraph,
      });
    }
  }
  return { questions: out };
}