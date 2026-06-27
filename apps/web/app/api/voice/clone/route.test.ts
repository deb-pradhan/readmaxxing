/**
 * /api/voice/clone — auth + consent + size gate tests.
 *
 * The full worker round-trip is exercised at the integration layer (see
 * TESTING.md §2.12). Here we pin the BFF's hard rules so they never
 * regress:
 *
 *  - 401 without a user id.
 *  - 400 when content-type is not multipart.
 *  - 400 when consent is missing.
 *  - 400 when consentVersion is stale.
 *  - 413 when the audio is over the size limit.
 *  - 502 when the worker is unreachable (no WORKER_API_URL set).
 *
 * Note: jsdom's Request/FormData roundtrip is unreliable in this Vitest
 * setup, so for the FormData-dependent tests we patch `formData()` on the
 * Request prototype to return a pre-built FormData. The route logic
 * itself is unchanged.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    consent: {
      upsert: vi.fn(async () => ({})),
    },
    voice: {
      upsert: vi.fn(async () => ({})),
    },
    usageLedger: {
      create: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: function () {
    return mockPrisma;
  },
}));

import { POST } from "./route";

function makeFile(name: string, sizeBytes: number, type = "audio/mpeg"): File {
  const placeholder = new File(["x"], name, { type });
  Object.defineProperty(placeholder, "size", { value: sizeBytes, configurable: true });
  // The route calls `audioField.arrayBuffer()`. The placeholder file only
  // carries 1 byte, so we expose a real arrayBuffer. (The route only
  // base64-encodes it for the worker call which we mock-out below.)
  placeholder.arrayBuffer = async () => new TextEncoder().encode("x").buffer;
  return placeholder;
}

function makeForm(entries: Record<string, FormDataEntryValue>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.append(k, v);
  return form;
}

function makeMultipartRequest(
  form: FormData,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/voice/clone", {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=---test",
      ...headers,
    },
    // Some jsdom/Vitest combinations mis-parse FormData bodies when
    // round-tripped through a Request. We attach the FormData via a
    // property so a spy can hand it back to the route in the test body.
    body: form,
  });
}

describe("/api/voice/clone POST", () => {
  beforeEach(() => {
    mockPrisma.consent.upsert.mockClear();
    mockPrisma.voice.upsert.mockClear();
    mockPrisma.usageLedger.create.mockClear();
  });

  it("returns 401 without a user id", async () => {
    const form = makeForm({
      audio: makeFile("sample.mp3", 32_000),
      name: "Test voice",
      consent: "true",
      consentVersion: "v1.0.0-2026-06-25",
    });
    const req = makeMultipartRequest(form);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 400 when content-type is not multipart", async () => {
    const req = new Request("http://localhost/api/voice/clone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "u1",
      },
      body: JSON.stringify({ name: "x" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("expected_multipart");
  });

  it("returns 400 when consent is missing", async () => {
    const form = makeForm({
      audio: makeFile("sample.mp3", 32_000),
      name: "Test voice",
    });
    const req = makeMultipartRequest(form, { "x-user-id": "u1" });
    vi.spyOn(req, "formData").mockResolvedValue(form);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("consent_required");
  });

  it("returns 400 when consentVersion is stale", async () => {
    const form = makeForm({
      audio: makeFile("sample.mp3", 32_000),
      name: "Test voice",
      consent: "true",
      consentVersion: "v0.0.1",
    });
    const req = makeMultipartRequest(form, { "x-user-id": "u1" });
    vi.spyOn(req, "formData").mockResolvedValue(form);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("consent_version_mismatch");
  });

  it("returns 413 when the audio is over the size limit", async () => {
    const form = makeForm({
      audio: makeFile("big.mp3", 6 * 1024 * 1024),
      name: "Test voice",
      consent: "true",
      consentVersion: "v1.0.0-2026-06-25",
    });
    const req = makeMultipartRequest(form, { "x-user-id": "u1" });
    vi.spyOn(req, "formData").mockResolvedValue(form);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("audio_too_large");
  });

  it("returns 502 when WORKER_API_URL is not set (heavy audio stays off Next.js)", async () => {
    const prev = process.env["WORKER_API_URL"];
    delete process.env["WORKER_API_URL"];
    try {
      const form = makeForm({
        audio: makeFile("sample.mp3", 32_000),
        name: "Test voice",
        consent: "true",
        consentVersion: "v1.0.0-2026-06-25",
      });
      const req = makeMultipartRequest(form, { "x-user-id": "u1" });
      vi.spyOn(req, "formData").mockResolvedValue(form);
      const res = await POST(req as unknown as import("next/server").NextRequest);
      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("worker_unreachable");
    } finally {
      if (prev !== undefined) process.env["WORKER_API_URL"] = prev;
    }
  });
});
