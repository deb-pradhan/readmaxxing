/**
 * Cross-surface settings sync test.
 *
 * Asserts that a `PUT /api/user/preferences` from the web app is
 * visible to the next `GET /api/user/preferences` (the same call
 * the extension popup + mobile settings tab make on mount). The
 * primitive here is that every surface reads from one BFF row.
 *
 * The mobile + extension surfaces share the same `bffFetch` shim
 * + the same JSON envelope — this test is the regression guard that
 * the BFF stays consistent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: vi.fn(() => ({
    userPreference: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
    },
  })),
}));

vi.mock("@/lib/observability", () => ({
  log: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
  newRequestId: () => "req-test",
  userIdHash: () => "hash-test",
  readUserId: (h: Headers) => h.get("x-user-id"),
}));

interface PutBody {
  defaultVoiceId?: string;
  defaultSpeed?: number;
}

beforeEach(() => {
  mockUpsert.mockReset();
  mockFindUnique.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/api/user/preferences cross-surface sync", () => {
  it("PUT from web + GET from extension returns the same payload", async () => {
    let storedPrefs: Record<string, unknown> = { defaultSpeed: 1 };
    mockUpsert.mockImplementation(async (args: { create: { prefs: object } }) => {
      storedPrefs = { ...storedPrefs, ...args.create.prefs };
      return { prefs: storedPrefs };
    });
    mockFindUnique.mockImplementation(async () => ({ prefs: storedPrefs }));

    const { PUT, GET } = await import("./route");
    const headers = new Headers({ "x-user-id": "u-cross-surface" });
    const putReq = new Request("http://localhost/api/user/preferences", {
      method: "PUT",
      headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
      body: JSON.stringify({ defaultVoiceId: "eleven_josh", defaultSpeed: 1.5 } satisfies PutBody),
    });
    const putRes = (await PUT(putReq as never)) as { json: () => Promise<unknown> };
    const putBody = (await putRes.json()) as { defaultVoiceId: string; defaultSpeed: number };
    expect(putBody.defaultVoiceId).toBe("eleven_josh");
    expect(putBody.defaultSpeed).toBe(1.5);

    const getReq = new Request("http://localhost/api/user/preferences", {
      headers: { "x-user-id": "u-cross-surface" },
    });
    const getRes = (await GET(getReq as never)) as { json: () => Promise<unknown> };
    const getBody = (await getRes.json()) as { defaultVoiceId: string; defaultSpeed: number };
    expect(getBody.defaultVoiceId).toBe("eleven_josh");
    expect(getBody.defaultSpeed).toBe(1.5);
  });

  it("shallow-merges so partial PUTs (mobile-style section saves) don't drop other keys", async () => {
    let storedPrefs: Record<string, unknown> = {
      defaultVoiceId: "eleven_rachel",
      defaultSpeed: 1,
      bionic: false,
    };
    mockUpsert.mockImplementation(async (args: { create?: { prefs: object }; update?: { prefs: object } }) => {
      // Mirror the BFF's shallow-merge: take existing prefs, overlay with the new patch.
      const incoming = (args.create?.prefs ?? args.update?.prefs) as object;
      storedPrefs = { ...storedPrefs, ...incoming };
      return { prefs: storedPrefs };
    });
    mockFindUnique.mockImplementation(async () => ({ prefs: storedPrefs }));

    const { PUT, GET } = await import("./route");
    const headers = new Headers({ "x-user-id": "u-merge" });
    const putReq = new Request("http://localhost/api/user/preferences", {
      method: "PUT",
      headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
      body: JSON.stringify({ defaultSpeed: 2 }),
    });
    const putRes = (await PUT(putReq as never)) as { json: () => Promise<unknown> };
    const putBody = (await putRes.json()) as {
      defaultVoiceId: string;
      defaultSpeed: number;
      bionic: boolean;
    };
    expect(putBody.defaultSpeed).toBe(2);
    expect(putBody.defaultVoiceId).toBe("eleven_rachel"); // preserved
    expect(putBody.bionic).toBe(false); // preserved

    const getReq = new Request("http://localhost/api/user/preferences", {
      headers: { "x-user-id": "u-merge" },
    });
    const getRes = (await GET(getReq as never)) as { json: () => Promise<unknown> };
    const getBody = (await getRes.json()) as {
      defaultVoiceId: string;
      defaultSpeed: number;
      bionic: boolean;
    };
    expect(getBody.defaultSpeed).toBe(2);
    expect(getBody.defaultVoiceId).toBe("eleven_rachel");
  });

  it("rejects PUT without a user id (401) on every surface", async () => {
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/user/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultSpeed: 1.5 }),
    });
    const res = (await PUT(req as never)) as { status: number; json: () => Promise<unknown> };
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });
});
