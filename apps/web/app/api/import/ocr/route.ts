/**
 * POST /api/import/ocr — Phase 5 "Scan & Listen" endpoint.
 *
 * Accepts `multipart/form-data` with:
 *   - `image`  : the scanned image (PNG/JPG/WEBP/TIFF, ≤ 5 MB)
 *   - `title`  : optional title for the new document
 *
 * Scanned PDFs are rejected (415) — vision-LLM OCR works on images, not
 * PDFs, and per-page rasterization would reintroduce a native dependency.
 *
 * Per UI-UX.md §5.5 + the v1 plan "Scan & Listen":
 *   1) Read the bytes (raw bytes stay client-side per D2).
 *   2) Forward to the worker (`/v1/ocr`), which runs a vision model via
 *      OpenRouter and returns text + a confidence score.
 *   3) Build a SegmentTree in-process and persist a Document so the
 *      player can read the scanned text.
 *   4) Return `{ documentId, pageCount, medianConfidence, lowConfidence }`
 *      so the UI can show honest progress.
 *
 * Privacy: never log raw image bytes; only `bytes`, `page_count`,
 * `median_confidence` (TESTING.md §8.7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import {
  buildSegmentTree,
  type DocumentSourceType,
  type SegmentTree,
} from "@readmaxxing/core";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const MAX_BYTES = 5 * 1024 * 1024;
const CONFIDENCE_WARN_THRESHOLD = 0.7;

interface OcrWorkerResponse {
  document_id: string;
  text: string;
  engine: string;
  language: string;
  page_count: number;
  median_confidence: number;
  low_confidence: boolean;
  confidence_per_page: number[];
  duration_ms: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected_multipart", message: "Use multipart/form-data with image or pdf." },
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

  const imageField = form.get("image");
  const pdfField = form.get("pdf");
  const titleField = form.get("title");

  const hasImage = imageField instanceof File;
  const hasPdf = pdfField instanceof File;
  if (!hasImage && !hasPdf) {
    return NextResponse.json(
      { error: "missing_file", message: "Attach an image or scanned PDF under 'image' / 'pdf'." },
      { status: 400 },
    );
  }
  if (hasImage && hasPdf) {
    return NextResponse.json(
      { error: "both_files", message: "Send only one of 'image' or 'pdf', not both." },
      { status: 400 },
    );
  }

  // Vision-LLM OCR works on images, not PDFs. Scanned PDFs would need
  // per-page rasterization (a native dependency we deliberately don't ship).
  if (hasPdf) {
    return NextResponse.json(
      {
        error: "pdf_not_supported",
        message:
          "Scanned PDFs aren't supported yet — upload a photo or image of the page, or import a text PDF via the normal importer.",
      },
      { status: 415 },
    );
  }

  const file = imageField as File;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  }

  const title = typeof titleField === "string" && titleField.trim().length > 0
    ? titleField.trim()
    : (file.name || "Scanned document").replace(/\.[^.]+$/, "");

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    bytes: file.size,
    filename_extension: (file.name.split(".").pop() ?? "").toLowerCase(),
  };

  log.info({ ...baseFields, event: "ocr.import_received" });

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileBase64 = fileBuffer.toString("base64");

  let workerResult: OcrWorkerResponse;
  try {
    workerResult = await callWorkerOcr({
      imageBase64: fileBase64,
      documentId: "pending",
    });
  } catch (err) {
    log.error({
      ...baseFields,
      event: "ocr.import_failed",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    return NextResponse.json(
      { error: "ocr_unavailable", message: "Couldn't read the image — retry." },
      { status: 502 },
    );
  }

  if (workerResult.low_confidence) {
    log.warn({
      ...baseFields,
      event: "ocr.low_confidence",
      page_count: workerResult.page_count,
      median_confidence: workerResult.median_confidence,
    });
  }

  if (!workerResult.text || workerResult.text.trim().length === 0) {
    return NextResponse.json(
      {
        error: "ocr_empty",
        message: "We couldn't read this clearly — try a sharper photo.",
        page_count: workerResult.page_count,
        median_confidence: workerResult.median_confidence,
      },
      { status: 400 },
    );
  }

  // Build the segment tree + persist.
  const tree: SegmentTree = buildSegmentTree(workerResult.text, {
    documentId: "pending",
    language: workerResult.language === "eng" ? "en" : workerResult.language,
  });
  const sourceType: DocumentSourceType = "txt";

  let doc: { id: string; addedAt: Date };
  try {
    await db().user.upsert({
      where: { id: userId },
      create: { id: userId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    const created = await db().document.create({
      data: {
        userId,
        title,
        source: file.name || "ocr-scan",
        sourceType,
        language: workerResult.language === "eng" ? "en" : workerResult.language,
        segmentTreeId: tree.segmentTreeId,
        segmentTree: tree as unknown as object,
        wordCount: tree.wordCount,
        estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
        sizeBytes: file.size,
      },
      select: { id: true, addedAt: true },
    });
    doc = created;
  } catch (err) {
    log.error({
      ...baseFields,
      event: "ocr.db_persist_failed",
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    return NextResponse.json(
      { error: "db_error", message: "Couldn't save the scanned document." },
      { status: 500 },
    );
  }

  log.info({
    ...baseFields,
    event: "ocr.import_complete",
    document_id: doc.id,
    page_count: workerResult.page_count,
    median_confidence: workerResult.median_confidence,
    duration_ms: workerResult.duration_ms,
  });

  return NextResponse.json(
    {
      documentId: doc.id,
      title,
      wordCount: tree.wordCount,
      estimatedReadTimeSeconds: tree.estimatedReadTimeSeconds,
      pageCount: workerResult.page_count,
      medianConfidence: workerResult.median_confidence,
      lowConfidence: workerResult.low_confidence,
      addedAt: doc.addedAt.toISOString(),
      status: "parsed",
    },
    { status: 201 },
  );
}

async function callWorkerOcr(args: {
  imageBase64: string;
  documentId: string;
}): Promise<OcrWorkerResponse> {
  const base = process.env["WORKER_API_URL"];
  if (!base) {
    throw new Error("worker_unreachable: WORKER_API_URL is not configured");
  }
  const controller = new AbortController();
  // Vision-LLM OCR on a single image typically returns in a few seconds;
  // allow headroom for a slow provider.
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${base}/v1/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Token": process.env["WORKER_API_TOKEN"] ?? "local-dev-token",
      },
      body: JSON.stringify({
        document_id: args.documentId,
        image_base64: args.imageBase64,
        language: "eng",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`worker ${res.status}: ${text.slice(0, 240)}`);
    }
    return (await res.json()) as OcrWorkerResponse;
  } finally {
    clearTimeout(timer);
  }
}
