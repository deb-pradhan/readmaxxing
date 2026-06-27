/**
 * XP calculator — unit tests for `packages/core/src/habits/xp-calculator.ts`.
 */

import { describe, it, expect } from "vitest";
import { calculateXP, isStreakMilestone, STREAK_MILESTONE_TABLE, XP_ACTION_TO_SOURCE } from "./xp-calculator";

describe("calculateXP", () => {
  it("LISTEN_MINUTE awards 1 XP per minute", () => {
    const r = calculateXP({ action: "LISTEN_MINUTE", quantity: 5 });
    expect(r.xpAmount).toBe(5);
    expect(r.source).toBe("listening");
  });

  it("LISTEN_MINUTE defaults to quantity 1", () => {
    const r = calculateXP({ action: "LISTEN_MINUTE" });
    expect(r.xpAmount).toBe(1);
  });

  it("COMPLETE_DOC awards 50 XP", () => {
    const r = calculateXP({ action: "COMPLETE_DOC" });
    expect(r.xpAmount).toBe(50);
    expect(r.source).toBe("reading");
  });

  it("COMPLETE_QUIZ awards 25 XP", () => {
    const r = calculateXP({ action: "COMPLETE_QUIZ" });
    expect(r.xpAmount).toBe(25);
    expect(r.source).toBe("quiz");
  });

  it("QUIZ_PERFECT awards 10 XP with a reason", () => {
    const r = calculateXP({ action: "QUIZ_PERFECT" });
    expect(r.xpAmount).toBe(10);
    expect(r.multiplierReason).toMatch(/perfect/i);
  });

  it("COMPLETE_PODCAST awards 30 XP", () => {
    const r = calculateXP({ action: "COMPLETE_PODCAST" });
    expect(r.xpAmount).toBe(30);
    expect(r.source).toBe("podcast");
  });

  it("DAILY_GOAL_MET awards 20 XP with a reason", () => {
    const r = calculateXP({ action: "DAILY_GOAL_MET" });
    expect(r.xpAmount).toBe(20);
    expect(r.source).toBe("daily_goal_bonus");
    expect(r.multiplierReason).toBeDefined();
  });

  it("STREAK_MILESTONE awards the matching milestone", () => {
    for (const m of STREAK_MILESTONE_TABLE) {
      const r = calculateXP({ action: "STREAK_MILESTONE", streakDays: m.days });
      expect(r.xpAmount).toBe(m.xp);
      expect(r.source).toBe("streak_bonus");
      expect(r.multiplierReason).toBeDefined();
    }
  });

  it("STREAK_MILESTONE for a non-milestone day returns 0", () => {
    const r = calculateXP({ action: "STREAK_MILESTONE", streakDays: 4 });
    expect(r.xpAmount).toBe(0);
  });

  it("OCR_PAGE awards 15 XP per page", () => {
    const r = calculateXP({ action: "OCR_PAGE", quantity: 3 });
    expect(r.xpAmount).toBe(45);
    expect(r.source).toBe("ocr");
  });

  it("VOICE_TYPING_MINUTE awards 3 XP per minute", () => {
    const r = calculateXP({ action: "VOICE_TYPING_MINUTE", quantity: 4 });
    expect(r.xpAmount).toBe(12);
    expect(r.source).toBe("voice_typing");
  });

  it("XP_ACTION_TO_SOURCE is the single source of truth", () => {
    expect(XP_ACTION_TO_SOURCE.LISTEN_MINUTE).toBe("listening");
    expect(XP_ACTION_TO_SOURCE.OCR_PAGE).toBe("ocr");
    expect(XP_ACTION_TO_SOURCE.QUIZ_PERFECT).toBe("quiz");
  });
});

describe("isStreakMilestone", () => {
  it("returns true for known milestone days", () => {
    for (const m of STREAK_MILESTONE_TABLE) {
      expect(isStreakMilestone(m.days)).toBe(true);
    }
  });

  it("returns false for non-milestone days", () => {
    expect(isStreakMilestone(0)).toBe(false);
    expect(isStreakMilestone(1)).toBe(false);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(13)).toBe(false);
  });
});
