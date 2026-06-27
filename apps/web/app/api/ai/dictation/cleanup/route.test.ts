/**
 * /api/ai/dictation/cleanup — auth + word-diff unit tests.
 *
 * We mock the `@readmaxxing/ai` `complete` call so the test doesn't need
 * an OPENROUTER_API_KEY. The diff algorithm is also tested directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { wordDiff } from "./route";

const { mockComplete } = vi.hoisted(() => ({
  mockComplete: vi.fn(async () => ({
    text: JSON.stringify({ cleaned: "Hello world." }),
    model: "openai/gpt-4o-mini",
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, provider: "OpenAI" },
  })),
}));

vi.mock("@readmaxxing/ai", async () => {
  const actual = await vi.importActual<typeof import("@readmaxxing/ai")>("@readmaxxing/ai");
  return {
    ...actual,
    complete: mockComplete,
  };
});

import { POST } from "./route";

describe("/api/ai/dictation/cleanup", () => {
  beforeEach(() => {
    mockComplete.mockClear();
    mockComplete.mockResolvedValue({
      text: JSON.stringify({ cleaned: "Hello world." }),
      model: "openai/gpt-4o-mini",
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, provider: "OpenAI" },
    });
  });

  it("returns 401 without a user id", async () => {
    const req = new Request("http://localhost/api/ai/dictation/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original: "hello world" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    const req = new Request("http://localhost/api/ai/dictation/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns cleaned text + diff on success", async () => {
    mockComplete.mockResolvedValueOnce({
      text: JSON.stringify({ cleaned: "Hello there." }),
      model: "openai/gpt-4o-mini",
      usage: { inputTokens: 2, outputTokens: 2, costUsd: 0, provider: "OpenAI" },
    });
    const req = new Request("http://localhost/api/ai/dictation/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ original: "Hello there." }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cleaned: string; diff: Array<{ op: string; text: string }> };
    expect(body.cleaned).toBe("Hello there.");
    expect(body.diff.length).toBeGreaterThan(0);
    expect(body.diff.every((d) => d.op === "unchanged")).toBe(true);
  });

  it("preserves cleanup when the model returns fenced JSON", async () => {
    mockComplete.mockResolvedValueOnce({
      text: "```json\n{ \"cleaned\": \"Hi.\" }\n```",
      model: "openai/gpt-4o-mini",
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, provider: "OpenAI" },
    });
    const req = new Request("http://localhost/api/ai/dictation/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ original: "Hi" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cleaned: string };
    expect(body.cleaned).toBe("Hi.");
  });
});

describe("wordDiff", () => {
  it("returns all-unchanged for identical inputs", () => {
    const d = wordDiff("Hello world", "Hello world");
    expect(d.every((op) => op.op === "unchanged")).toBe(true);
  });

  it("marks a removed word with op=removed", () => {
    const d = wordDiff("Hello uh world", "Hello world");
    const removed = d.filter((op) => op.op === "removed");
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.map((r) => r.text).join("")).toContain("uh");
  });

  it("marks a new word with op=added", () => {
    const d = wordDiff("Hello world", "Hello there world");
    const added = d.filter((op) => op.op === "added");
    expect(added.length).toBeGreaterThan(0);
    expect(added.map((r) => r.text).join("")).toContain("there");
  });

  it("preserves whitespace tokens", () => {
    const d = wordDiff("Hello   world  today", "Hello   earth today");
    // The unchanged tokens should preserve the multi-space gaps.
    const unchanged = d.filter((op) => op.op === "unchanged").map((op) => op.text);
    expect(unchanged.join("")).toContain("Hello");
    expect(unchanged.join("")).toContain("today");
    // Whitespace tokens are emitted (the diff is whitespace-aware).
    expect(d.some((op) => op.text.includes("   "))).toBe(true);
  });

  it("handles empty cleaned", () => {
    const d = wordDiff("Hello world", "");
    expect(d.every((op) => op.op === "removed")).toBe(true);
  });

  it("handles empty original", () => {
    const d = wordDiff("", "Hello");
    expect(d.every((op) => op.op === "added")).toBe(true);
  });
});
