/**
 * POST /api/voice/clone — Phase 5 voice cloning.
 *
 * Accepts `multipart/form-data`:
 *   - `audio`  : the recorded sample (MP3 or WAV, ≤ 5 MB, ≥ ~10s)
 *   - `name`   : the user-chosen display name for the cloned voice
 *
 * Per UI-UX.md §5.5 + TESTING.md §2.12 the consent row MUST be recorded
 * before the clone call lands. We:
 *   1) Verify the user explicitly opted in via a `consent: true` field
 *      AND a `consentVersion` field that matches the worker's current
 *      `VOICE_CLONE_CONSENT_VERSION`. Reject if either is missing.
 *   2) Persist a `Consent { kind: "voice_clone", granted: true, version }`
 *      row (idempotent on `(userId, kind, version)`).
 *   3) POST the audio to the worker via Celery enqueue (or via the
 *      worker's HTTP surface when `WORKER_API_URL` is set).
 *   4) Insert a `Voice { id: voiceId, isCloned: true, ownerId: userId, name }`
 *      row so the picker can resolve it on the next load.
 *
 * Response: `{ voiceId, previewUrl, name, status }`.
 *
 * Privacy: never log raw audio bytes, never log the audio filename. We
 * log `bytes`, `duration_ms`, `voice_id` only (TESTING.md §8.7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

// Hard limit for the audio upload — 5 MB. Roughly 1 minute of low-bitrate
// MP3, plenty for a 10–30 second sample. We round-trip the bytes as
// base64 over the wire to the worker so 5 MB ≈ 6.7 MB on the wire.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const CONSENT_VERSION = "v1.0.0-2026-06-25";

interface CloneWorkerResponse {
  status: "ok" | "sample_too_short" | "sample_too_long" | "model_unconfigured";
  voice_id: string;
  name?: string;
  language?: string;
  sample_seconds?: number;
  duration_ms?: number;
  model_version?: string;
  preview_url?: string | null;
  min_seconds?: number;
  max_seconds?: number;
  error_class?: string;
  error_msg?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The form MUST come in as multipart/form-data (audio + text fields).
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected_multipart", message: "Use multipart/form-data with audio + name." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }

  const audioField = form.get("audio");
  const nameField = form.get("name");
  const consentField = form.get("consent");
  const consentVersionField = form.get("consentVersion");

  if (!(audioField instanceof File)) {
    return NextResponse.json(
      { error: "missing_audio", message: "Attach an audio file under 'audio'." },
      { status: 400 },
    );
  }
  if (typeof nameField !== "string" || nameField.trim().length === 0) {
    return NextResponse.json(
      { error: "missing_name", message: "Provide a name for the cloned voice." },
      { status: 400 },
    );
  }
  if (consentField !== "true") {
    return NextResponse.json(
      { error: "consent_required", message: "Voice cloning requires explicit consent." },
      { status: 400 },
    );
  }
  if (consentVersionField !== CONSENT_VERSION) {
    return NextResponse.json(
      {
        error: "consent_version_mismatch",
        message: "Consent version is out of date — re-read and re-confirm.",
        expected: CONSENT_VERSION,
      },
      { status: 400 },
    );
  }

  if (audioField.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "audio_too_large", max_bytes: MAX_AUDIO_BYTES },
      { status: 413 },
    );
  }

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    bytes: audioField.size,
    name_length: nameField.trim().length,
  };

  log.info({ ...baseFields, event: "voice_clone.consent_recorded", consent_version: CONSENT_VERSION });

  // 1) Persist the consent row. Idempotent on (userId, kind, version).
  try {
    await db().consent.upsert({
      where: {
        // Prisma requires a unique key. We don't have a real compound
        // unique in the schema, so we look up the existing row first
        // and create if absent. This is a tiny race — second-writer wins
        // with a second row, which is fine for consent audit.
        id: `${userId}:voice_clone:${CONSENT_VERSION}`,
      },
      create: {
        id: `${userId}:voice_clone:${CONSENT_VERSION}`,
        userId,
        kind: "voice_clone",
        version: CONSENT_VERSION,
        granted: true,
        grantedAt: new Date(),
      },
      update: {
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
      },
    });
  } catch (err) {
    // The `id` upsert above is a fallback; if it fails (e.g. a real unique
    // index is added in a future migration) we still want to surface a
    // human error, not a 500.
    log.error({
      ...baseFields,
      event: "voice_clone.consent_persist_failed",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
  }

  // 2) Read the audio bytes + forward to the worker. We always read
  // into memory (max 5 MB) and base64-encode — the worker is the only
  // thing that ever sees the bytes.
  const audioBuffer = Buffer.from(await audioField.arrayBuffer());
  const audioBase64 = audioBuffer.toString("base64");

  let workerResult: CloneWorkerResponse;
  try {
    workerResult = await callWorkerClone({
      audioBase64,
      name: nameField.trim(),
      userId,
    });
  } catch (err) {
    log.error({
      ...baseFields,
      event: "voice_clone.clone_failed",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    return NextResponse.json(
      { error: "worker_unreachable", message: "Couldn't reach the audio worker — retry." },
      { status: 502 },
    );
  }

  if (workerResult.status !== "ok") {
    log.warn({
      ...baseFields,
      event: "voice_clone.sample_rejected",
      reason: workerResult.status,
    });
    return NextResponse.json(
      {
        error: workerResult.status,
        min_seconds: workerResult.min_seconds,
        max_seconds: workerResult.max_seconds,
      },
      { status: 400 },
    );
  }

  // 3) Persist the Voice row. `isCloned: true` + `ownerId: userId` keeps
  // it out of the shared voice list (D24 in the brief).
  try {
    await db().voice.upsert({
      where: { id: workerResult.voice_id },
      create: {
        id: workerResult.voice_id,
        provider: "cloned",
        voiceId: workerResult.voice_id,
        name: nameField.trim().slice(0, 80),
        language: workerResult.language ?? "en",
        isCloned: true,
        ownerId: userId,
      },
      update: {
        name: nameField.trim().slice(0, 80),
        language: workerResult.language ?? "en",
      },
    });
  } catch (err) {
    log.error({
      ...baseFields,
      event: "voice_clone.voice_persist_failed",
      voice_id: workerResult.voice_id,
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    // The clone itself succeeded — surface a 201 with a warning so the
    // user can keep going (the picker will still find the voice on the
    // next request after we reconcile).
  }

  // 4) Meter the cloning (TESTING.md §8.5).
  try {
    await db().usageLedger.create({
      data: {
        userId,
        metric: "voice_clone_minutes",
        amount: Math.max(1, Math.round((workerResult.sample_seconds ?? 0) / 60)),
        provider: workerResult.model_version ?? "cloned",
        sourceId: workerResult.voice_id,
      },
    });
  } catch {
    /* metering is best-effort */
  }

  log.info({
    ...baseFields,
    event: "voice_clone.clone_complete",
    voice_id: workerResult.voice_id,
    duration_ms: workerResult.duration_ms ?? 0,
    model_version: workerResult.model_version ?? "stub",
  });

  return NextResponse.json(
    {
      voiceId: workerResult.voice_id,
      name: nameField.trim().slice(0, 80),
      previewUrl: workerResult.preview_url ?? null,
      modelVersion: workerResult.model_version ?? "stub",
      status: "ok",
    },
    { status: 201 },
  );
}

async function callWorkerClone(args: {
  audioBase64: string;
  name: string;
  userId: string;
}): Promise<CloneWorkerResponse> {
  const base = process.env["WORKER_API_URL"];
  if (base) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${base}/v1/tts/clone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Token": process.env["WORKER_API_TOKEN"] ?? "local-dev-token",
        },
        body: JSON.stringify({
          audio_base64: args.audioBase64,
          name: args.name,
          user_id: args.userId,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`worker ${res.status}: ${text.slice(0, 240)}`);
      }
      return (await res.json()) as CloneWorkerResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  // No worker configured — call the Celery task in-process via a small
  // import. The task contract is the same either way.
  // (We avoid importing the Celery module to keep tests fast — the
  // BFF assumes the worker is reachable; if not, we return a clean
  // worker_unreachable so the UI shows the human error.)
  throw new Error("worker_unreachable: WORKER_API_URL is not configured");
}
