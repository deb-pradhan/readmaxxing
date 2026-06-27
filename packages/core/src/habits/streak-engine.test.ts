/**
 * Streak engine — unit tests for the pure functions in
 * `packages/core/src/habits/streak-engine.ts`. Per the brief these must
 * be runnable without any DB / network / time-of-day dependency.
 */

import { describe, it, expect } from "vitest";
import {
  calculateCurrentStreak,
  canRecover,
  daysBetween,
  daysUntilFreezeReset,
  mondayOf,
  type StreakStateLike,
} from "./streak-engine";

const BASE_STATE: StreakStateLike = {
  currentDays: 5,
  longestDays: 12,
  freezesAvailable: 1,
  freezesUsedThisWeek: 0,
  lastActiveDate: "2026-06-23",
  recoveredAt: null,
};

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-06-23", "2026-06-23")).toBe(0);
  });

  it("returns 1 for adjacent dates", () => {
    expect(daysBetween("2026-06-23", "2026-06-24")).toBe(1);
  });

  it("returns 2 for a one-day gap", () => {
    expect(daysBetween("2026-06-23", "2026-06-25")).toBe(2);
  });

  it("handles month boundaries", () => {
    expect(daysBetween("2026-06-30", "2026-07-01")).toBe(1);
  });

  it("handles year boundaries", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("returns negative for an earlier date", () => {
    expect(daysBetween("2026-06-25", "2026-06-23")).toBe(-2);
  });
});

describe("calculateCurrentStreak", () => {
  it("starts a fresh streak on first active day", () => {
    const r = calculateCurrentStreak({
      state: null,
      today: "2026-06-23",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.longestDays).toBe(1);
    expect(r.lastActiveDate).toBe("2026-06-23");
    expect(r.message).toBe("started");
    expect(r.didFreeze).toBe(false);
    expect(r.didRecover).toBe(false);
  });

  it("is idempotent when called twice on the same day", () => {
    const r = calculateCurrentStreak({
      state: { ...BASE_STATE, lastActiveDate: "2026-06-23", currentDays: 1 },
      today: "2026-06-23",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.message).toBe("already_active");
  });

  it("returns the existing state when activeToday is false", () => {
    const r = calculateCurrentStreak({
      state: BASE_STATE,
      today: "2026-06-25",
      activeToday: false,
    });
    expect(r.currentStreak).toBe(5);
    expect(r.didFreeze).toBe(false);
    expect(r.didRecover).toBe(false);
  });

  it("increments by 1 on consecutive days", () => {
    const r = calculateCurrentStreak({
      state: { ...BASE_STATE, lastActiveDate: "2026-06-23", currentDays: 3 },
      today: "2026-06-24",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(4);
    expect(r.message).toBe("incremented");
    expect(r.longestDays).toBe(Math.max(4, BASE_STATE.longestDays));
  });

  it("uses 24h recovery when last active was 2 days ago and no recovery was used", () => {
    const r = calculateCurrentStreak({
      state: { ...BASE_STATE, lastActiveDate: "2026-06-23", currentDays: 3, recoveredAt: null },
      today: "2026-06-25",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(4);
    expect(r.didRecover).toBe(true);
    expect(r.didFreeze).toBe(false);
    expect(r.recoveredAt).toBe("2026-06-25");
  });

  it("does NOT recover twice for the same break", () => {
    const r = calculateCurrentStreak({
      state: {
        ...BASE_STATE,
        lastActiveDate: "2026-06-23",
        currentDays: 3,
        recoveredAt: "2026-06-23", // already used for this break
      },
      today: "2026-06-25",
      activeToday: true,
    });
    // The branch above falls through to the "no freeze available" path
    // because the state has no freezes left by default. With freeze
    // available it freezes, otherwise it restarts.
    expect(r.didRecover).toBe(false);
  });

  it("uses a freeze when 2+ days have passed and a freeze is available", () => {
    const r = calculateCurrentStreak({
      state: {
        ...BASE_STATE,
        lastActiveDate: "2026-06-23",
        currentDays: 7,
        freezesAvailable: 1,
        freezesUsedThisWeek: 0,
      },
      today: "2026-06-26",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(8);
    expect(r.didFreeze).toBe(true);
    expect(r.didRecover).toBe(false);
    expect(r.freezesAvailable).toBe(0);
    expect(r.freezesUsedThisWeek).toBe(1);
    expect(r.message).toBe("frozen");
  });

  it("restarts the streak when a break goes past the recovery + freeze window", () => {
    const r = calculateCurrentStreak({
      state: {
        ...BASE_STATE,
        longestDays: 10,
        lastActiveDate: "2026-06-20",
        currentDays: 10,
        freezesAvailable: 0,
        freezesUsedThisWeek: 0,
      },
      today: "2026-06-26",
      activeToday: true,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.message).toBe("restarted");
    expect(r.longestDays).toBe(10);
  });

  it("never produces a negative streak", () => {
    const r = calculateCurrentStreak({
      state: {
        ...BASE_STATE,
        lastActiveDate: "2026-05-01",
        currentDays: 0,
        freezesAvailable: 0,
        freezesUsedThisWeek: 0,
      },
      today: "2026-06-26",
      activeToday: true,
    });
    expect(r.currentStreak).toBeGreaterThanOrEqual(0);
    expect(r.currentStreak).toBe(1);
  });
});

describe("canRecover", () => {
  it("is true on the day after the missed day (2-day gap)", () => {
    expect(
      canRecover({ lastBrokenDate: "2026-06-23", today: "2026-06-25", recoveredAt: null }),
    ).toBe(true);
  });

  it("is false if the recovery was already used for the break", () => {
    expect(
      canRecover({
        lastBrokenDate: "2026-06-23",
        today: "2026-06-25",
        recoveredAt: "2026-06-23",
      }),
    ).toBe(false);
  });

  it("is false if the window has passed", () => {
    expect(
      canRecover({ lastBrokenDate: "2026-06-20", today: "2026-06-25", recoveredAt: null }),
    ).toBe(false);
  });

  it("is false for same-day queries", () => {
    expect(
      canRecover({ lastBrokenDate: "2026-06-25", today: "2026-06-25", recoveredAt: null }),
    ).toBe(false);
  });
});

describe("mondayOf + daysUntilFreezeReset", () => {
  it("returns the same date when input is a Monday", () => {
    expect(mondayOf("2026-06-22")).toBe("2026-06-22");
  });

  it("walks back from Wednesday to the previous Monday", () => {
    expect(mondayOf("2026-06-24")).toBe("2026-06-22");
  });

  it("walks back from Sunday to the previous Monday", () => {
    expect(mondayOf("2026-06-28")).toBe("2026-06-22");
  });

  it("daysUntilFreezeReset is bounded to 0-7", () => {
    const v = daysUntilFreezeReset(mondayOf("2026-06-22"));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(7);
  });
});
