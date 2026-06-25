import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/import — Phase 2 entry point.
 *
 * Phase 2 wires this to:
 *   1) accept paste / file upload / URL in the request body,
 *   2) extract text (PDF/DOCX/EPUB in the worker, MD/TXT/paste in-line,
 *      URL via Playwright + Readability),
 *   3) enqueue `app.tasks.parse.parse_document` on the Celery `parse` queue,
 *   4) upsert the resulting SegmentTree into `Document.segmentTree` (Postgres),
 *   5) return `{ documentId, status: "queued" | "parsed" }` so the client can
 *      navigate to `/reader/[docId]`.
 *
 * Per the v1 plan §"Blobs — hybrid (Option B)" the raw uploaded file never
 * leaves the client — only the extracted text + segment tree is sent to the
 * server (privacy + no blob storage cost). The raw file stays in IndexedDB.
 */

export const runtime = "nodejs";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "not_implemented",
      message: "Phase 2 will wire the real parser pipeline (Celery → SegmentTree → Postgres).",
    },
    { status: 501 },
  );
}