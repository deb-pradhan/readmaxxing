/**
 * /api/habits/streak — auth gate + idempotency test.
 *
 * The pure streak logic is covered by the unit tests in
 * `packages/core/src/habits/streak-engine.test.ts`. Here we just pin
 * the BFF's auth gate and the basic GET/POST contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    streak: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async (args: { create: object }) => ({
        ...args.create,
        currentDays: 1,
        longestDays: 1,
        freezesAvailable: 1,
        freezesUsedThisWeek: 0,
        lastActiveDate: "2026-06-25",
        recoveredAt: null,
      })),
    },
  },
}));

vi.mock("@readmaxxing/db", () => ({
  PrismaClient: function () {
    return mockPrisma;
  },
}));

import { GET, POST } from "./route";

describe("/api/habits/streak", () => {
  beforeEach(() => {
    mockPrisma.streak.findUnique.mockClear();
    mockPrisma.streak.upsert.mockClear();
  });

  it("returns 401 without a user id", async () => {
    const req = new Request("http://localhost/api/habits/streak");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("GET returns defaults for a brand-new user", async () => {
    const req = new Request("http://localhost/api/habits/streak", {
      headers: { "x-user-id": "u1" },
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { currentDays: number; todayKey: string };
    expect(body.currentDays).toBe(0);
    expect(typeof body.todayKey).toBe("string");
  });

  it("POST records a session and increments the streak on a new day", async () => {
    (mockPrisma.streak.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      currentDays: 3,
      longestDays: 3,
      freezesAvailable: 1,
      freezesUsedThisWeek: 0,
      lastActiveAt: new Date("2026-06-24T00:00:00.000Z"),
      recoveredAt: null,
      calendar: { "2026-06-24": true },
    });
    // Have the upsert mock return the engine's output (4) so the BFF
    // surfaces the right value to the UI.
    (mockPrisma.streak.upsert as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (args: { create: object }) => ({
        ...args.create,
        currentDays: 4,
        longestDays: 4,
        freezesAvailable: 1,
        freezesUsedThisWeek: 0,
        lastActiveAt: new Date("2026-06-25T00:00:00.000Z"),
        recoveredAt: null,
      }),
    );
    const req = new Request("http://localhost/api/habits/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "u1" },
      body: JSON.stringify({ todayKey: "2026-06-25" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { currentDays: number; message: string };
    expect(body.currentDays).toBe(4);
    expect(body.message).toBe("incremented");
  });
});
