/**
 * /api/ai/podcasts/[id]/progress — auth + cached terminal state tests.
 *
 * The SSE proxy short-circuits to a single terminal frame when the
 * episode is already `completed` or `failed`. We assert that path
 * because it's the only one we can drive deterministically without a
 * running worker.
 */

import { describe, it, expect, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    podcastEpisode: {
      findFirst: vi.fn(async () => null) as any,
    },
  },
}));

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: function () {
    return mockPrisma;
  },
}));

import { GET } from "./route";

describe("/api/ai/podcasts/[id]/progress GET", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/podcasts/ep1/progress");
    const res = await GET(req as unknown as import("next/server").NextRequest, {
      params: { id: "ep1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the episode doesn't exist or isn't owned by the user", async () => {
    mockPrisma.podcastEpisode.findFirst.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/ai/podcasts/ep1/progress", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest, {
      params: { id: "ep1" },
    });
    expect(res.status).toBe(404);
  });

  it("streams an SSE terminal frame immediately for completed episodes", async () => {
    mockPrisma.podcastEpisode.findFirst.mockResolvedValueOnce({
      id: "ep1",
      status: "completed",
      audioPath: "doc1/ep1.mp3",
      progress: { stage: "completed", duration_ms: 12000 },
    });
    const req = new Request("http://localhost/api/ai/podcasts/ep1/progress", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest, {
      params: { id: "ep1" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    // Either we replay the cached stage from `progress` first…
    // …or the terminal `completed` frame from the early-return path.
    expect(text).toMatch(/event: completed/);
  });

  it("streams a failure frame for failed episodes", async () => {
    mockPrisma.podcastEpisode.findFirst.mockResolvedValueOnce({
      id: "ep2",
      status: "failed",
      audioPath: "",
      progress: { stage: "failed", error_msg: "TTS quota exceeded" },
    });
    const req = new Request("http://localhost/api/ai/podcasts/ep2/progress", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest, {
      params: { id: "ep2" },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/event: failed/);
  });
});