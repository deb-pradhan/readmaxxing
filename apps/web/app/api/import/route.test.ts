/**
 * /api/import — audit C1 (Phase C P0) coverage.
 *
 * Asserts the new contract:
 *   - POST returns 201 with `{ documentId, ... }` and a deprecated `id`
 *     alias for one release so older extension / mobile consumers keep
 *     working.
 *   - Auth/validation paths (401, 400) remain unchanged.
 *   - The route does not swallow import failures as opaque HTTP statuses.
 *
 * The route's deep paths (`fetchUrl` → worker, `cleanForReading` → LLM)
 * are mocked so the test stays offline + deterministic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpsert, mockCreate } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: vi.fn(() => ({
    user: { upsert: mockUpsert },
    document: { create: mockCreate },
  })),
}));

vi.mock("@/lib/observability", () => ({
  log: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
  newRequestId: () => "req-test",
  userIdHash: () => "hash-test",
  readUserId: (h: Headers) => h.get("x-user-id"),
}));

vi.mock("@readmaxxing/ai", async () => {
  const actual = await vi.importActual<typeof import("@readmaxxing/ai")>("@readmaxxing/ai");
  return {
    ...actual,
    complete: vi.fn(async () => ({ text: "cleaned text", model: "test", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } })),
  };
});

beforeEach(() => {
  mockUpsert.mockReset();
  mockCreate.mockReset();
  // Default: no worker URL → URL path will return 502; tests don't exercise it.
  delete process.env["WORKER_API_URL"];
  delete process.env["OPENROUTER_API_KEY"];
  mockUpsert.mockResolvedValue({});
  mockCreate.mockResolvedValue({
    id: "doc-1",
    addedAt: new Date("2026-06-27T00:00:00Z"),
  });
});

async function importPOST(body: object, opts: { withUserId?: boolean } = {}) {
  const { POST } = await import("./route");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.withUserId !== false) headers["x-user-id"] = "u-test";
  const req = new Request("http://localhost/api/import", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req as unknown as import("next/server").NextRequest);
}

describe("/api/import (audit C1)", () => {
  it("returns 401 without a user id header", async () => {
    const res = await importPOST({ text: "hello", title: "T" }, { withUserId: false });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("POST /api/import with text returns 201 with documentId + legacy id alias", async () => {
    const res = await importPOST({ text: "hello world", title: "Test", sourceType: "txt" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      documentId: string;
      id?: string;
      status: string;
      title: string;
    };
    // Audit C1: documentId is the canonical field.
    expect(body.documentId).toBe("doc-1");
    // Legacy alias for one release.
    expect(body.id).toBe("doc-1");
    expect(body.status).toBe("parsed");
    expect(body.title).toBe("Test");
  });

  it("POST /api/import with empty body returns 400 with a human error code", async () => {
    const res = await importPOST({});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    // Error envelope uses a human-readable code, not a raw HTTP code.
    expect(body.error).toBe("empty_text");
  });
});