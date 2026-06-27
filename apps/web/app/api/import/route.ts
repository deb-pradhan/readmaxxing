/**
 * POST /api/import — Phase 2 real importer.
 *
 * Accepts paste / file upload / URL in the request body:
 *   - { text, title, sourceType }  → build SegmentTree in-process, persist
 *   - { url }                       → server-side fetch + Readability, then
 *                                    the text path
 *
 * Per the v1 plan §"Blobs — hybrid (Option B)" the raw uploaded file never
 * leaves the client — only the extracted text + segment tree is sent to the
 * server (privacy + no blob storage cost). The raw file stays in IndexedDB.
 *
 * Returns `{ documentId, status: "parsed" }` so the client can navigate to
 * `/reader/[docId]`. We also keep `id` as a deprecated alias for one release
 * (audit C1) so any Chrome extension / older mobile consumer that still reads
 * `id` keeps working. New consumers must read `documentId`.
 *
 * URL fetching is best-effort — when the worker is unreachable we still accept
 * the URL and queue a stub parse task.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import {
  buildSegmentTree,
  type DocumentSourceType,
  type SegmentTree,
} from "@readmaxxing/core";
import { complete } from "@readmaxxing/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z.object({
  title: z.string().min(1).max(200).optional(),
  text: z.string().min(1).max(2_000_000).optional(),
  url: z.string().url().optional(),
  source: z.string().max(500).optional(),
  sourceType: z
    .enum(["pdf", "docx", "md", "epub", "txt", "url", "paste"])
    .default("paste"),
  language: z.string().default("en"),
});

interface FetchResult {
  text: string;
  title: string;
}

async function fetchUrl(url: string): Promise<FetchResult> {
  const target = process.env["WORKER_API_URL"] ?? "http://localhost:8000";
  const res = await fetch(`${target}/v1/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Token": process.env["WORKER_API_TOKEN"] ?? "local-dev-token",
    },
    body: JSON.stringify({
      document_id: "pending",
      source: url,
      source_type: "url",
    }),
  });
  if (!res.ok) {
    throw new Error(`Worker fetch failed (${res.status})`);
  }
  const data = (await res.json()) as { text?: string; title?: string };
  return {
    text: typeof data.text === "string" ? data.text : "",
    title: typeof data.title === "string" ? data.title : url,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id") ?? request.headers.get("x-dev-user-id");
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

  let text = body.text ?? "";
  let title = body.title ?? "Pasted text";
  let sourceType: DocumentSourceType = body.sourceType;
  let source = body.source ?? "pasted";

  if (!text && body.url) {
    try {
      const fetched = await fetchUrl(body.url);
      text = fetched.text;
      title = fetched.title;
      sourceType = "url";
      source = body.url;
    } catch (err) {
      return NextResponse.json(
        {
          error: "fetch_failed",
          message: `Couldn't fetch URL — ${(err as Error).message}`,
        },
        { status: 502 },
      );
    }
  }

  if (!text || text.trim().length === 0) {
    return NextResponse.json(
      { error: "empty_text", message: "Provide text or a URL." },
      { status: 400 },
    );
  }

  // Convert messy/raw (often Markdown) content into clean, well-structured
  // text BEFORE building the tree — so the displayed text, the audio, and the
  // word-timings all derive from the same clean source (karaoke stays in sync).
  text = await cleanForReading(text);

  if (!text || text.trim().length === 0) {
    return NextResponse.json(
      { error: "empty_text", message: "Provide text or a URL." },
      { status: 400 },
    );
  }

  const tree: SegmentTree = buildSegmentTree(text, {
    documentId: "pending",
    language: body.language,
  });

  try {
    await db().user.upsert({
      where: { id: userId },
      create: { id: userId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    const doc = await db().document.create({
      data: {
        userId,
        title,
        source,
        sourceType,
        language: body.language,
        segmentTreeId: tree.segmentTreeId,
        segmentTree: tree as unknown as object,
        wordCount: tree.wordCount,
        estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
      },
      select: { id: true, addedAt: true },
    });

    // Fire-and-forget filler detection so the player can auto-skip low-value
    // segments (UI-UX.md §4.9, §7). Non-blocking — we don't want import to
    // wait on the LLM. The `fillerSegments` column may not exist yet if
    // migrations haven't run; the route handles that case.
    if (process.env["OPENROUTER_API_KEY"]) {
      void fetch(`${request.nextUrl.origin}/api/ai/fillers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ documentId: doc.id }),
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        documentId: doc.id,
        // Deprecated alias — kept for one release so older extension / mobile
        // consumers that still read `id` keep working. New consumers must use
        // `documentId` (audit C1).
        id: doc.id,
        status: "parsed",
        title,
        wordCount: tree.wordCount,
        estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
        addedAt: doc.addedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("import.POST failed", err);
    return NextResponse.json(
      { error: "db_error", message: "Couldn't persist the document." },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    supportedSources: ["pdf", "docx", "md", "epub", "txt", "url", "paste"],
    maxBytes: 2_000_000,
  });
}

const CLEANUP_SYSTEM_PROMPT =
  "You reformat raw text into clean, well-structured Markdown for a text-to-speech reading app. " +
  "Rules: fix obvious typos, OCR errors, and stray symbols/artifacts; use '# ', '## ', '### ' " +
  "headings, short readable paragraphs, and '- ' bullet lists where natural; preserve ALL the " +
  "original meaning and wording — do NOT summarize, shorten, translate, or omit content; separate " +
  "blocks with a blank line; never wrap the output in code fences or add commentary. " +
  "Return ONLY the cleaned Markdown.";

/**
 * Turn raw/messy content into clean reading text. Uses an LLM (when an
 * OpenRouter key is configured) to fix typos + structure into Markdown, then a
 * deterministic pass strips inline Markdown symbols so they are never spoken or
 * shown — while keeping '# ' heading lines so the parser can set headingLevel.
 */
async function cleanForReading(raw: string): Promise<string> {
  const trimmed = raw.trim();
  // Short snippets aren't worth an LLM round-trip; just strip inline markers.
  if (!process.env["OPENROUTER_API_KEY"] || trimmed.length < 200) {
    return stripInlineMarkdown(trimmed);
  }
  try {
    const res = await complete({
      messages: [
        { role: "system", content: CLEANUP_SYSTEM_PROMPT },
        { role: "user", content: trimmed.slice(0, 100_000) },
      ],
      temperature: 0.2,
      maxTokens: 8000,
      appMetadata: { feature: "format" },
    });
    const md = res.text?.trim();
    return md ? stripInlineMarkdown(md) : stripInlineMarkdown(trimmed);
  } catch {
    // Never let formatting block an import — fall back to the deterministic pass.
    return stripInlineMarkdown(trimmed);
  }
}

/**
 * Remove inline Markdown symbols that would otherwise be spoken aloud or shown
 * literally, while preserving '#'/'##'/'###' heading prefixes (the segment-tree
 * parser uses them to set headingLevel and strips them from the words).
 */
function stripInlineMarkdown(input: string): string {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    let line = raw;
    // Drop horizontal rules (---, ***, ___).
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push("");
      continue;
    }
    // Blockquote markers.
    line = line.replace(/^\s*>\s?/, "");
    // Leading list markers (-, *, +, "1.") — keep the item text.
    line = line.replace(/^(\s*)(?:[-*+]|\d+\.)\s+/, "$1");
    // Images ![alt](url) -> alt
    line = line.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    // Links [text](url) -> text
    line = line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    // Inline emphasis / code: **x**, *x*, __x__, _x_, `x`
    line = line.replace(/\*\*([^*]+)\*\*/g, "$1");
    line = line.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1");
    line = line.replace(/__([^_]+)__/g, "$1");
    line = line.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1");
    line = line.replace(/`([^`]+)`/g, "$1");
    // Any stray emphasis characters left over.
    line = line.replace(/\*\*/g, "").replace(/`/g, "");
    out.push(line);
  }
  // Isolate each heading as its own block (blank line before & after) so the
  // parser treats it as a heading paragraph and strips its '#' marker — even
  // when the source put a title and subtitle on consecutive lines.
  const isolated: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const line = out[i]!;
    const isHeading = /^#{1,6}\s/.test(line);
    if (isHeading && isolated.length > 0 && isolated[isolated.length - 1] !== "") {
      isolated.push("");
    }
    isolated.push(line);
    if (isHeading && i + 1 < out.length && out[i + 1] !== "") {
      isolated.push("");
    }
  }
  // Collapse 3+ blank lines down to a single blank line (paragraph break).
  return isolated.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}