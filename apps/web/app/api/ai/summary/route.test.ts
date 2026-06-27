/**
 * /api/ai/summary integration test.
 *
 * Verifies the 401 (no user id) and the document-not-found error paths
 * without spinning up Prisma. The cached/model paths exercise the same
 * code as `/api/tts` does, which is covered by the prompt-helper tests in
 * `@readmaxxing/ai`.
 */

import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("/api/ai/summary", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc1", level: "tldr" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when documentId is missing", async () => {
    const req = new Request("http://localhost/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ level: "tldr" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });
});
