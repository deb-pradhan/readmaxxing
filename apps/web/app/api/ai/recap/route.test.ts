/**
 * /api/ai/recap route — Phase E (E.8) wiring verification.
 *
 * Confirms:
 *  - Auth gate (401 without a user id header)
 *  - documentId required (400 otherwise)
 *  - Document not owned by the user → 404
 *  - No last position → 200 with `{recap: null, reason: "no_position"}`
 *    (this is the path the library page relies on for "don't render the
 *    recap card").
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    document: { findFirst: vi.fn() },
    playbackPosition: { findFirst: vi.fn() },
    recapCache: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: function () {
    return mockPrisma;
  },
}));

vi.mock("@/lib/ai/document-loader", () => ({
  loadDocument: vi.fn(async () => null),
  loadLastPosition: vi.fn(async () => null),
  anchorForWord: vi.fn(),
}));

vi.mock("@/lib/ai/worker-bridge", () => ({
  dispatchAi: vi.fn(),
}));

vi.mock("@readmaxxing/ai", () => ({
  buildRecapPrompt: vi.fn(() => ({ system: "", prompt: "" })),
}));

vi.mock("@/lib/observability", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  newRequestId: vi.fn(() => "rid"),
  readUserId: vi.fn((h: Headers) => h.get("x-user-id")),
  timed: vi.fn(async ({ fn }: { fn: () => Promise<unknown> }) => await fn()),
  userIdHash: vi.fn((u: string) => `hash(${u})`),
}));

import { GET } from "./route";

describe("/api/ai/recap (Phase E — E.8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/recap?documentId=doc1");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when documentId is missing", async () => {
    const req = new Request("http://localhost/api/ai/recap", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 404 when the document is not owned by the user", async () => {
    const req = new Request("http://localhost/api/ai/recap?documentId=doc-missing", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("document_not_found");
  });

  it("returns 200 with recap=null + reason='no_position' when the user has no playback for the doc", async () => {
    const { loadDocument, loadLastPosition } = await import("@/lib/ai/document-loader");
    vi.mocked(loadDocument).mockResolvedValueOnce({
      id: "doc1",
      text: "hello",
      tree: { text: "hello", paragraphs: [] } as never,
    } as never);
    vi.mocked(loadLastPosition).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/ai/recap?documentId=doc1", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recap: unknown; reason?: string };
    expect(body.recap).toBeNull();
    expect(body.reason).toBe("no_position");
  });
});