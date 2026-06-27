/**
 * /api/ai/podcasts — auth + validation tests.
 *
 * The happy-path (worker → DB → manifest) is exercised at the integration
 * layer (see TESTING.md §2.9); the unit tests here pin the auth gate, the
 * request validation, and the chunked pagination shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma so the routes can run without a Postgres connection.
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      podcastEpisode: {
        create: vi.fn(async () => ({ id: "ep1" })) as any,
        update: vi.fn(async () => ({})) as any,
        findMany: vi.fn(async () => []) as any,
        count: vi.fn(async () => 0) as any,
      },
      podcast: {
        findFirst: vi.fn(async () => null) as any,
        create: vi.fn(async () => ({ id: "pod1" })) as any,
      },
      document: {
        findFirst: vi.fn(async () => null) as any,
      },
    },
  };
});

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: function () {
    return mockPrisma;
  },
}));

import { POST, GET } from "./route";

describe("/api/ai/podcasts POST", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/podcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", style: "podcast" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when neither documentId nor prompt is provided", async () => {
    const req = new Request("http://localhost/api/ai/podcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ style: "podcast" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 404 when documentId is provided but not owned by the user", async () => {
    mockPrisma.document.findFirst.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/ai/podcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ documentId: "doc-missing", style: "podcast" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("document_not_found");
  });

  it("returns 502 when WORKER_API_URL is not set (audio work must stay off Next.js)", async () => {
    const prev = process.env["WORKER_API_URL"];
    delete process.env["WORKER_API_URL"];
    mockPrisma.document.findFirst.mockResolvedValueOnce({
      id: "doc1",
      title: "Sample",
      segmentTree: { text: "body text" },
    });
    try {
      const req = new Request("http://localhost/api/ai/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": "u1" },
        body: JSON.stringify({ documentId: "doc1", style: "podcast" }),
      });
      const res = await POST(req as unknown as import("next/server").NextRequest);
      // Without a worker we surface a structured failure (the queued row
      // is updated to `failed` + `worker_unreachable` error message).
      expect([502, 500]).toContain(res.status);
    } finally {
      if (prev !== undefined) process.env["WORKER_API_URL"] = prev;
    }
  });
});

describe("/api/ai/podcasts GET", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/podcasts");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("rejects unknown styles with 400", async () => {
    const req = new Request("http://localhost/api/ai/podcasts?style=audiodrama", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_style");
  });

  it("returns a paginated envelope on success", async () => {
    mockPrisma.podcastEpisode.findMany.mockResolvedValueOnce([]);
    mockPrisma.podcastEpisode.count.mockResolvedValueOnce(0);
    const req = new Request("http://localhost/api/ai/podcasts?page=1", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      page: number;
      chunk_size: number;
      total: number;
      has_more: boolean;
      episodes: unknown[];
    };
    expect(body.page).toBe(1);
    expect(body.chunk_size).toBe(7);
    expect(body.total).toBe(0);
    expect(body.has_more).toBe(false);
    expect(Array.isArray(body.episodes)).toBe(true);
  });
});