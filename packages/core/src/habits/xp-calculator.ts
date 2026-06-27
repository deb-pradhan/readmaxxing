/**
 * XP calculator — pure functions for the Phase 5.5 habit layer.
 *
 * Per the v1 plan, the brief, and packages/config/src/constants.ts, every
 * `XPAction` maps to a base XP amount. Variable-reward bonuses are applied
 * on top via `multiplierReason` so the UI can show *why* a number changed
 * ("Streak milestone × 2!" or "Perfect quiz +10").
 *
 * This module is pure (no Prisma, no fetch, no `Date.now()` in the
 * deterministic paths) so it's trivially unit-testable per the brief:
 * "The streak engine + XP calculator must be pure so they can be unit-tested
 * without DB."
 */

import type { XpSource } from "@readmaxxing/config";

/** Closed set of XP-eligible actions. Matches the `XpSource` enum in the
 *  Prisma schema; we keep this as a string-literal union for type safety
 *  on the consumer side. */
export type XPAction =
  | "LISTEN_MINUTE"
  | "COMPLETE_DOC"
  | "COMPLETE_QUIZ"
  | "QUIZ_PERFECT"
  | "COMPLETE_PODCAST"
  | "DAILY_GOAL_MET"
  | "STREAK_MILESTONE"
  | "OCR_PAGE"
  | "VOICE_TYPING_MINUTE";

/** Prisma's `XpSource` enum value, used when persisting. */
export const XP_ACTION_TO_SOURCE: Record<XPAction, XpSource> = {
  LISTEN_MINUTE: "listening",
  COMPLETE_DOC: "reading",
  COMPLETE_QUIZ: "quiz",
  QUIZ_PERFECT: "quiz",
  COMPLETE_PODCAST: "podcast",
  DAILY_GOAL_MET: "daily_goal_bonus",
  STREAK_MILESTONE: "streak_bonus",
  OCR_PAGE: "ocr",
  VOICE_TYPING_MINUTE: "voice_typing",
};

export interface XPCalcInput {
  action: XPAction;
  /** Quantity for unit-denominated actions (minutes / pages). Default 1. */
  quantity?: number;
  /** Current streak (only used by STREAK_MILESTONE). */
  streakDays?: number;
}

export interface XPCalcResult {
  xpAmount: number;
  /** Why a multiplier was applied (UI string, never shame language). */
  multiplierReason?: string;
  /** Source for the `XpEvent.source` column. */
  source: XpSource;
}

// Base values — calibrated to the brief + UI-UX.md §8 (pressure-without-shame).
const BASE = {
  LISTEN_MINUTE: 1,
  COMPLETE_DOC: 50,
  COMPLETE_QUIZ: 25,
  QUIZ_PERFECT: 10,
  COMPLETE_PODCAST: 30,
  DAILY_GOAL_MET: 20,
  OCR_PAGE: 15,
  VOICE_TYPING_MINUTE: 3,
} as const;

// Streak milestones — variable bonus per the spec. Each milestone is a
// multiple of 7 with a one-time XP award. UI-UX.md §8: "Variable bonus XP
// for quizzes taken, podcasts finished, etc."
const STREAK_MILESTONES: Array<{ days: number; xp: number; label: string }> = [
  { days: 3, xp: 10, label: "3-day spark" },
  { days: 7, xp: 25, label: "1-week reader" },
  { days: 14, xp: 75, label: "2-week warrior" },
  { days: 30, xp: 200, label: "30-day streak" },
  { days: 100, xp: 500, label: "100-day legend" },
];

/**
 * Calculate XP for an action. Returns the XP amount, an optional
 * multiplier reason for the UI, and the Prisma source enum.
 */
export function calculateXP(input: XPCalcInput): XPCalcResult {
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const source = XP_ACTION_TO_SOURCE[input.action];

  switch (input.action) {
    case "LISTEN_MINUTE": {
      const base = BASE.LISTEN_MINUTE * quantity;
      return { xpAmount: base, source };
    }
    case "COMPLETE_DOC": {
      return { xpAmount: BASE.COMPLETE_DOC, source };
    }
    case "COMPLETE_QUIZ": {
      const base = BASE.COMPLETE_QUIZ;
      return { xpAmount: base, source };
    }
    case "QUIZ_PERFECT": {
      // Bonus on top of a quiz completion — the route adds this *after*
      // calculateXP("COMPLETE_QUIZ"). We expose it as a standalone entry
      // for flexibility.
      return {
        xpAmount: BASE.QUIZ_PERFECT,
        source,
        multiplierReason: "Perfect score bonus",
      };
    }
    case "COMPLETE_PODCAST": {
      return { xpAmount: BASE.COMPLETE_PODCAST, source };
    }
    case "DAILY_GOAL_MET": {
      return {
        xpAmount: BASE.DAILY_GOAL_MET,
        source,
        multiplierReason: "Daily goal met",
      };
    }
    case "STREAK_MILESTONE": {
      const days = Math.max(0, input.streakDays ?? 0);
      const milestone = STREAK_MILESTONES.filter((m) => m.days === days).at(-1);
      if (!milestone) {
        return { xpAmount: 0, source };
      }
      return {
        xpAmount: milestone.xp,
        source,
        multiplierReason: `Streak milestone — ${milestone.label}`,
      };
    }
    case "OCR_PAGE": {
      const base = BASE.OCR_PAGE * quantity;
      return {
        xpAmount: base,
        source,
        multiplierReason: quantity > 1 ? `${quantity} pages scanned` : undefined,
      };
    }
    case "VOICE_TYPING_MINUTE": {
      const base = BASE.VOICE_TYPING_MINUTE * quantity;
      return { xpAmount: base, source };
    }
    default: {
      // Exhaustive — TS will flag a missing case.
      const _exhaustive: never = input.action;
      return { xpAmount: 0, source: _exhaustive };
    }
  }
}

/** Whether `days` triggers a streak-milestone XP award. */
export function isStreakMilestone(days: number): boolean {
  return STREAK_MILESTONES.some((m) => m.days === days);
}

/** List of known streak milestones (for the badges grid / quest descriptions). */
export const STREAK_MILESTONE_TABLE = STREAK_MILESTONES;
