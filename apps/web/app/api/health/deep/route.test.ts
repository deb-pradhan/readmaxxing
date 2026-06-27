/**
 * /api/health/deep — regression test for the deep liveness endpoint.
 *
 * We assert the response shape + the per-probe behavior using a mocked
 * Prisma + a stubbed fetch for the worker ping. The Redis probe's
 * `not_configured` path is exercised by clearing `REDIS_URL`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma so we never touch the real DB.
const mockQueryRaw = vi.fn();
vi.mock("@readmaxxing/db", () => ({
  PrismaClient: vi.fn(() => ({
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  })),
}));

// Mock next/server so the route's NextResponse shape is testable.
vi.mock("next/server", async () => {
  return {
    NextResponse: {
      json(body: unknown, init?: { status?: number }) {
        return { json: async () => body, status: init?.status ?? 200 };
      },
    },
  };
});

// Mock observability so logs don't leak.
vi.mock("@/lib/observability", () => ({
  log: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
}));

import { GET } from "./route";

const originalEnv = { ...process.env };

describe("/api/health/deep", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  function fakeRequest() {
    return { headers: new Headers(), url: "http://localhost/api/health/deep" } as never;
  }

  it("returns 200 with all probes ok when dependencies are healthy", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    process.env["REDIS_URL"] = ""; // soft-skip
    process.env["WORKER_API_URL"] = "http://worker";
    process.env["WORKER_API_TOKEN"] = "tok";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", { status: 200 }),
    );
    const res = (await GET(fakeRequest())) as { status: number; json: () => Promise<unknown> };
    const body = (await res.json()) as {
      ok: boolean;
      checks: {
        postgres: { ok: boolean; latency_ms: number };
        redis: { ok: boolean; error?: string };
        worker: { ok: boolean; latency_ms: number };
      };
    };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.postgres.ok).toBe(true);
    expect(body.checks.redis.ok).toBe(false);
    expect(body.checks.redis.error).toBe("not_configured");
    expect(body.checks.worker.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when Postgres probe fails", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("connection refused"));
    process.env["REDIS_URL"] = "";
    process.env["WORKER_API_URL"] = "";
    const res = (await GET(fakeRequest())) as { status: number; json: () => Promise<unknown> };
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      ok: boolean;
      checks: { postgres: { ok: boolean; error?: string } };
    };
    expect(body.ok).toBe(false);
    expect(body.checks.postgres.ok).toBe(false);
    expect(body.checks.postgres.error).toContain("connection refused");
  });

  it("reports worker probe error when fetch throws", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    process.env["REDIS_URL"] = "";
    process.env["WORKER_API_URL"] = "http://worker";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = (await GET(fakeRequest())) as { status: number; json: () => Promise<unknown> };
    const body = (await res.json()) as {
      checks: { worker: { ok: boolean; error?: string } };
    };
    expect(body.checks.worker.ok).toBe(false);
    expect(body.checks.worker.error).toContain("ECONNREFUSED");
  });
});
