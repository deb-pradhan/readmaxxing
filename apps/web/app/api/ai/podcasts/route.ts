/**
 * /api/ai/podcasts — Phase 4 podcast creator + list.
 *
 * - POST `{ documentId|prompt, style, title? }` kicks off the worker
 *   pipeline, persists the resulting `PodcastEpisode`, and returns the
 *   canonical row. The BFF prefers the worker when `WORKER_API_URL` is
 *   set (so heavy audio work stays out of the Next.js event loop); if the
 *   worker is unreachable we fall back to an in-process stub that returns
 *   a deterministic failure row (so the user still sees a calm error).
 *
 * - GET `?style=…` lists the user's completed podcast episodes, paginated
 *   to ≤ 7 per chunk per UI-UX.md §6 (Miller's Law). Filters by style.
 *
 * Per TESTING.md §9 every call emits `podcast.stage` / `podcast.complete` /
 * `podcast.error` events. Auth is enforced via `x-user-id` (or the dev
 * header), matching the rest of the BFF.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient, type PodcastStyle } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const VALID_STYLES = ["podcast", "late_night", "debate", "lecture"] as const;

const PostBody = z.object({
  /** Use a saved document as the source. */
  documentId: z.string().min(1).max(200).optional(),
  /** Or a free-text prompt (no document). */
  prompt: z.string().min(1).max(20_000).optional(),
  style: z.enum(VALID_STYLES).default("podcast"),
  title: z.string().min(1).max(200).optional(),
  hostVoiceId: z.string().min(1).max(100).default("Xb7hH8MSUJpSbSDYk0k2"),
  guestVoiceId: z.string().min(1).max(100).default("JBFqnCBsd6RMkjVDRZzb"),
}).refine((b) => Boolean(b.documentId) || Boolean(b.prompt), {
  message: "Either documentId or prompt is required.",
});

const LIST_CHUNK = 7;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    log.warn({
      event: "podcast.unauthorized",
      request_id: requestId,
      route: "/api/ai/podcasts",
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

  // Resolve the document text — either from the saved Document or from the
  // free-text prompt (the prompt itself becomes the source for the LLM).
  let documentId: string | null = null;
  let documentText: string;
  let title: string;
  if (body.documentId) {
    const doc = await db().document.findFirst({
      where: { id: body.documentId, userId },
      select: {
        id: true,
        title: true,
        segmentTree: true,
      },
    });
    if (!doc) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }
    documentId = doc.id;
    // Segment tree is a JSONB blob; the parser sets `text` on the root.
    const tree = doc.segmentTree as unknown as { text?: string } | null;
    documentText = tree?.text ?? "";
    title = body.title ?? doc.title;
  } else {
    documentText = body.prompt ?? "";
    title = body.title ?? "Untitled podcast";
  }

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    style: body.style,
    document_id: documentId,
    text_bytes: documentText.length,
  };

  log.info({
    ...baseFields,
    event: "podcast.stage",
    stage: "reading_doc",
    progress_pct: 1,
  });

  // 1) Persist a queued row up front so the UI can poll for progress even
  //    when the worker is slow.
  const episode = await db().podcastEpisode.create({
    data: {
      userId,
      podcastId: await _resolvePodcastId(db(), userId, title, body.style as PodcastStyle),
      title,
      script: [],
      audioPath: "",
      durationSeconds: 0,
      status: "queued",
      progress: { stage: "queued", request_id: requestId },
    },
  });

  // 2) Drive the worker pipeline.
  try {
    const manifest = await _runWorker({
      documentId: documentId ?? `prompt_${episode.id}`,
      documentText,
      style: body.style,
      title,
      hostVoiceId: body.hostVoiceId,
      guestVoiceId: body.guestVoiceId,
      requestId,
    });

    if (manifest.status === "failed") {
      log.error({
        ...baseFields,
        event: "podcast.error",
        episode_id: episode.id,
        error_class: manifest.error_class ?? "unknown",
        error_msg: manifest.error_msg ?? "unknown error",
      });
      const updated = await db().podcastEpisode.update({
        where: { id: episode.id },
        data: {
          status: "failed",
          progress: {
            stage: "failed",
            error_class: manifest.error_class,
            error_msg: manifest.error_msg,
          },
          errorMessage: manifest.error_msg ?? "podcast_generation_failed",
        },
      });
      return NextResponse.json(
        {
          error: "podcast_failed",
          message: "Couldn't produce the audio — try again in a moment.",
          episode: _episodeToJson(updated),
        },
        { status: 502 },
      );
    }

    // Convert relative `audio_url_path` → canonical audio path under the
    // worker's volume root. The BFF stream route forwards to the worker's
    // `/v1/podcast/{id}/audio` endpoint (which resolves the same file).
    const scriptLines = (manifest.lines ?? []) as unknown as Record<string, unknown>[];
    const updated = await db().podcastEpisode.update({
      where: { id: episode.id },
      data: {
        script: scriptLines as unknown as object,
        audioPath: manifest.audio_url_path ?? manifest.audio_path,
        durationSeconds: manifest.duration_seconds ?? 0,
        status: "completed",
        progress: {
          stage: "completed",
          duration_ms: manifest.duration_ms ?? 0,
          line_count: manifest.line_count ?? 0,
          speaker_count: manifest.speaker_count ?? 0,
        },
        completedAt: new Date(),
      },
    });

    log.info({
      ...baseFields,
      event: "podcast.complete",
      episode_id: episode.id,
      duration_ms: manifest.duration_ms ?? 0,
      line_count: manifest.line_count ?? 0,
      speaker_count: manifest.speaker_count ?? 0,
    });

    return NextResponse.json(
      {
        episode: _episodeToJson(updated),
      },
      { status: 201 },
    );
  } catch (err) {
    const message = (err as Error).message;
    log.error({
      ...baseFields,
      event: "podcast.error",
      episode_id: episode.id,
      error_class: (err as Error).name,
      error_msg: message.slice(0, 200),
    });
    await db().podcastEpisode.update({
      where: { id: episode.id },
      data: {
        status: "failed",
        errorMessage: message.slice(0, 200),
        progress: { stage: "failed", error_msg: message.slice(0, 200) },
      },
    });
    const isUnreachable = /worker_unreachable|fetch failed|connect/i.test(message);
    return NextResponse.json(
      {
        error: isUnreachable ? "worker_unreachable" : "podcast_failed",
        message: isUnreachable
          ? "Couldn't reach the audio worker — retry in a moment."
          : "Couldn't produce the audio — try again.",
        episode_id: episode.id,
      },
      { status: isUnreachable ? 502 : 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const style = url.searchParams.get("style");
  const pageRaw = url.searchParams.get("page");
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);

  if (style && !(VALID_STYLES as readonly string[]).includes(style)) {
    return NextResponse.json(
      { error: "invalid_style", allowed: VALID_STYLES },
      { status: 400 },
    );
  }

  const where = {
    userId,
    ...(style ? { podcast: { style: style as PodcastStyle } } : {}),
  };

  const [rows, total] = await Promise.all([
    db().podcastEpisode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIST_CHUNK,
      take: LIST_CHUNK,
      include: {
        podcast: { select: { id: true, style: true, title: true } },
      },
    }),
    db().podcastEpisode.count({ where }),
  ]);

  return NextResponse.json({
    page,
    chunk_size: LIST_CHUNK,
    total,
    has_more: page * LIST_CHUNK < total,
    episodes: rows.map(_episodeToJson),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _resolvePodcastId(
  db: PrismaClient,
  userId: string,
  title: string,
  style: PodcastStyle,
): Promise<string> {
  // Group episodes under a per-(title, style) Podcast row so the feed page
  // can render one card per "show" when more than one episode exists.
  const existing = await db.podcast.findFirst({
    where: { userId, title, style },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.podcast.create({
    data: { userId, title, style },
    select: { id: true },
  });
  return created.id;
}

async function _runWorker(args: {
  documentId: string;
  documentText: string;
  style: string;
  title: string;
  hostVoiceId: string;
  guestVoiceId: string;
  requestId: string;
}): Promise<{
  status: string;
  audio_path?: string;
  audio_url_path?: string;
  duration_ms?: number;
  duration_seconds?: number;
  lines?: unknown[];
  line_count?: number;
  speaker_count?: number;
  error_class?: string;
  error_msg?: string;
}> {
  const base = process.env["WORKER_API_URL"];
  if (base) {
    try {
      const controller = new AbortController();
      // Long-running podcasts — give the worker 6 minutes before bailing.
      const timer = setTimeout(() => controller.abort(), 6 * 60_000);
      const res = await fetch(`${base}/v1/podcast/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Token": process.env["WORKER_API_TOKEN"] ?? "local-dev-token",
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`worker ${res.status}: ${text.slice(0, 240)}`);
      }
      return (await res.json()) as ReturnType<typeof _runWorker> extends Promise<infer T> ? T : never;
    } catch (err) {
      // Network failure → bubble up so the BFF emits a structured log + 502.
      throw new Error(`worker_unreachable: ${(err as Error).message.slice(0, 200)}`);
    }
  }
  // No worker configured — return a clear failure so the UI can show a
  // human error. (We deliberately do not run pydub in the Next.js process;
  // audio mastering must stay on the worker.)
  throw new Error("worker_unreachable: WORKER_API_URL is not configured");
}

function _episodeToJson(row: {
  id: string;
  podcastId: string;
  title: string;
  script: unknown;
  audioPath: string;
  durationSeconds: number;
  status: string;
  progress: unknown;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  podcast?: { id: string; style: string; title: string } | null;
}): Record<string, unknown> {
  return {
    id: row.id,
    podcastId: row.podcastId,
    title: row.title,
    script: row.script,
    audioPath: row.audioPath,
    durationSeconds: row.durationSeconds,
    status: row.status,
    progress: row.progress,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    podcast: row.podcast ?? null,
  };
}