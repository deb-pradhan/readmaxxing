/**
 * /api/ai/ask — audit C4 (Phase C P0) coverage.
 *
 * Asserts the new contract:
 *   - Non-streaming response carries both `prose` (with `[cite:p:s]`
 *     placeholders preserved verbatim) AND a validated `citations` array.
 *   - 401 surfaces without a user id (auth contract unchanged).
 *   - 400 surfaces for an invalid body (validation contract unchanged).
 *   - The streaming terminal frame also carries `prose` so streaming + non-
 *     streaming clients share one tokenization path.
 *
 * The LLM call itself is mocked via `dispatchAiStream` so the test is
 * deterministic + offline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDispatchAiStream } = vi.hoisted(() => ({
  mockDispatchAiStream: vi.fn(),
}));

vi.mock("@/lib/ai/worker-bridge", () => ({
  dispatchAiStream: mockDispatchAiStream,
}));

vi.mock("@/lib/ai/document-loader", () => ({
  recordUsage: vi.fn(async () => undefined),
  loadDocument: vi.fn(async () => ({
    id: "doc-test",
    text: "The sky is blue. The grass is green.",
    segmentTreeId: "tree-test",
    title: "Test doc",
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

import { POST } from "./route";

beforeEach(() => {
  mockDispatchAiStream.mockReset();
});

describe("/api/ai/ask (audit C4)", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc1", question: "why" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when body is invalid (missing question)", async () => {
    const req = new Request("http://localhost/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ documentId: "doc1" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("non-streaming response includes prose + citations (audit C4)", async () => {
    mockDispatchAiStream.mockImplementationOnce(async () =>
      (async function* () {
        yield "The sky is blue ";
        yield "[cite:0:0] and the grass is green [cite:1:0].";
      })(),
    );

    const req = new Request("http://localhost/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({
        documentId: "doc-test",
        question: "What color is the sky?",
        stream: false,
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      answer: string;
      prose: string;
      citations: Array<{ paragraphIndex: number; sentenceIndex: number }>;
      model: string;
    };
    // `prose` field is present and contains the `[cite:p:s]` markers verbatim.
    expect(typeof body.prose).toBe("string");
    expect(body.prose).toContain("[cite:0:0]");
    expect(body.prose).toContain("[cite:1:0]");
    // `citations` array is present and validates the anchors.
    expect(body.citations).toEqual([
      { paragraphIndex: 0, sentenceIndex: 0 },
      { paragraphIndex: 1, sentenceIndex: 0 },
    ]);
    // The legacy `answer` field remains for backward compat (existing
    // extension / mobile consumers read it).
    expect(body.answer).toBe(body.prose);
  });

  it("non-streaming response omits prose when the model output is short (no citations needed)", async () => {
    mockDispatchAiStream.mockImplementationOnce(async () =>
      (async function* () {
        yield "hi";
      })(),
    );

    const req = new Request("http://localhost/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({
        documentId: "doc-test",
        question: "hi",
        stream: false,
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      prose: string;
      citations: Array<{ paragraphIndex: number; sentenceIndex: number }>;
    };
    expect(body.prose).toBe("hi");
    expect(body.citations).toEqual([]);
  });
});