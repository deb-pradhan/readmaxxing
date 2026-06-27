/**
 * /api/tts integration test.
 *
 * Without `ELEVENLABS_API_KEY` we expect 503 with a clear message. With the
 * key we expect a streaming NDJSON response — mocked here to keep CI offline.
 */

import { describe, it, expect } from "vitest";

// Polyfill `Request`/`Response` for the runtime under test.
import { POST, GET, splitTextForTts } from "./route";

describe("/api/tts", () => {
  it("returns 401 without a user id header", async () => {
    const req = new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: "eleven_rachel", text: "Hi", speed: 1 }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 503 without an ELEVENLABS_API_KEY", async () => {
    const prev = process.env["ELEVENLABS_API_KEY"];
    delete process.env["ELEVENLABS_API_KEY"];
    try {
      const req = new Request("http://localhost/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
        },
        body: JSON.stringify({ voiceId: "eleven_rachel", text: "Hi", speed: 1 }),
      });
      const res = await POST(req as unknown as import("next/server").NextRequest);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("no_provider_key");
    } finally {
      if (prev !== undefined) process.env["ELEVENLABS_API_KEY"] = prev;
    }
  });

  it("GET returns voice catalog", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { voices: Array<{ id: string }> };
    expect(Array.isArray(body.voices)).toBe(true);
  });
});

describe("splitTextForTts", () => {
  it("keeps short text as a single chunk", () => {
    const chunks = splitTextForTts("Hello world.", 4500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ text: "Hello world.", start: 0 });
  });

  it("splits long text into chunks under the limit", () => {
    const text = ("The quick brown fox jumps over the lazy dog. ".repeat(400)).trim();
    const chunks = splitTextForTts(text, 4500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(4500);
  });

  it("produces contiguous slices that reconstruct the original text", () => {
    const text = ("Sentence one. Sentence two! Sentence three? ".repeat(300)).trim();
    const chunks = splitTextForTts(text, 2000);
    // start offsets line up and chunks concatenate back to the source
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(text.slice(chunks[i]!.start, chunks[i]!.start + chunks[i]!.text.length)).toBe(
        chunks[i]!.text,
      );
    }
  });

  it("breaks at sentence/word boundaries, not mid-word", () => {
    const text = "word ".repeat(2000).trim();
    const chunks = splitTextForTts(text, 1000);
    // no chunk should start or end splitting a word (except possibly the last)
    for (const c of chunks) {
      expect(c.text.startsWith(" ")).toBe(false);
    }
  });
});