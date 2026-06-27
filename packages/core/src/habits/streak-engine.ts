/**
 * Streak engine — pure functions for the Phase 5.5 habit layer.
 *
 * UI-UX.md §8: "Streak freeze (earnable, 1/week base + bonus from milestones) and
 * 24h streak recovery so a missed day is recoverable, not catastrophic."
 *
 * Pressure-without-shame is enforced by the function shapes themselves: every
 * break is a recoverable break. The UI never sees "you lost" — it sees
 * "Streak frozen — pick it back up today."
 *
 * Dates are *user-local* calendar dates (YYYY-MM-DD strings), NOT UTC
 * timestamps. This matters because "today" for a reader in Tokyo is a
 * different calendar day than "today" in Berlin. The BFF converts the
 * user's clock to a date key on the way in.
 *
 * No `Date` arithmetic goes through `Date.now()` in the helpers below —
 * tests inject `today` as a string and check the output. This keeps the
 * engine framework-agnostic (D5: `packages/core` is pure TS).
 */

/** ISO date string in the user's local timezone, format `YYYY-MM-DD`. */
export type DateKey = string;

export interface StreakStateLike {
  /** Current streak in days. `0` means "not started yet". */
  currentDays: number;
  /** Longest streak ever achieved. */
  longestDays: number;
  /** Available streak freezes (capped at 3 by the per-week logic). */
  freezesAvailable: number;
  /** Freezes used in the current ISO week (resets Mondays, user-local). */
  freezesUsedThisWeek: number;
  /** Calendar date the user last hit the daily goal. */
  lastActiveDate: DateKey | null;
  /** Calendar date of the most recent successful recovery (24h grace use). */
  recoveredAt: DateKey | null;
}

export interface StreakInput {
  /** Current Streak row, or `null` for a brand-new user. */
  state: StreakStateLike | null;
  /** User-local "today" (YYYY-MM-DD). Tests inject this. */
  today: DateKey;
  /** Whether the user completed a session today. */
  activeToday: boolean;
  /**
   * Whether a freeze is available AND the user has not used their weekly
   * cap. Caller is the BFF — we keep the policy here, but the resource
   * check comes from the DB.
   */
  freezeAvailable?: boolean;
}

export interface StreakResult {
  /** New current streak. */
  currentStreak: number;
  /** Updated longest streak (if the new current > previous longest). */
  longestDays: number;
  /** Freezes remaining after this interaction. */
  freezesAvailable: number;
  /** Freezes used this ISO week after this interaction. */
  freezesUsedThisWeek: number;
  /** Updated `lastActiveDate`. */
  lastActiveDate: DateKey | null;
  /** Updated `recoveredAt` (set when a 24h-recovery fires). */
  recoveredAt: DateKey | null;
  /** True iff this interaction consumed a streak freeze. */
  didFreeze: boolean;
  /** True iff this interaction used the 24h recovery window. */
  didRecover: boolean;
  /** Human-readable message — for the UI; never includes shame language. */
  message: string;
}

const ZERO_STATE: StreakStateLike = {
  currentDays: 0,
  longestDays: 0,
  freezesAvailable: 1,
  freezesUsedThisWeek: 0,
  lastActiveDate: null,
  recoveredAt: null,
};

/** Days between two YYYY-MM-DD strings (positive = `b` is after `a`). */
export function daysBetween(a: DateKey, b: DateKey): number {
  // Strip time-zone surprises by anchoring to UTC midnight.
  const aMs = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10)),
  );
  const bMs = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10)),
  );
  return Math.round((bMs - aMs) / 86_400_000);
}

/**
 * Calculate the user's streak after today's session.
 *
 * Behavior matrix:
 *
 * | activeToday | lastActive = today    | lastActive = yesterday | lastActive = older |
 * |-------------|-----------------------|------------------------|---------------------|
 * | true        | no-op (idempotent)    | +1 day                 | freeze / recover / reset |
 * | false       | no-op (no event)      | n/a                    | n/a                 |
 *
 * - "freeze" requires `freezeAvailable` AND no break in the chain.
 * - "recover" is the 24h grace window: missing yesterday, but a session
 *   lands within 24h of the gap (i.e. today = lastActive + 2 AND
 *   `recoveredAt` is unset). The streak continues.
 * - Otherwise the streak resets to 1 (today's session) and the
 *   `lastActiveDate` is updated. We never expose negative streaks.
 */
export function calculateCurrentStreak(input: StreakInput): StreakResult {
  const state: StreakStateLike = input.state ?? ZERO_STATE;
  const today = input.today;
  const lastActive = state.lastActiveDate;

  // No event today — return the current state as-is. The BFF should only
  // call us when a listening event lands; this branch is a safety net so
  // it can also be called from a "recompute" job without side effects.
  if (!input.activeToday) {
    return {
      currentStreak: state.currentDays,
      longestDays: state.longestDays,
      freezesAvailable: state.freezesAvailable,
      freezesUsedThisWeek: state.freezesUsedThisWeek,
      lastActiveDate: lastActive,
      recoveredAt: state.recoveredAt,
      didFreeze: false,
      didRecover: false,
      message: "no_event",
    };
  }

  // First-ever active day.
  if (lastActive === null) {
    return {
      currentStreak: 1,
      longestDays: Math.max(1, state.longestDays),
      freezesAvailable: state.freezesAvailable,
      freezesUsedThisWeek: state.freezesUsedThisWeek,
      lastActiveDate: today,
      recoveredAt: state.recoveredAt,
      didFreeze: false,
      didRecover: false,
      message: "started",
    };
  }

  const gap = daysBetween(lastActive, today);

  // Same day — idempotent. We bump `lastActiveDate` to `today` only if
  // the caller passed an older date key (defensive; shouldn't happen).
  if (gap === 0) {
    return {
      currentStreak: state.currentDays,
      longestDays: state.longestDays,
      freezesAvailable: state.freezesAvailable,
      freezesUsedThisWeek: state.freezesUsedThisWeek,
      lastActiveDate: today,
      recoveredAt: state.recoveredAt,
      didFreeze: false,
      didRecover: false,
      message: "already_active",
    };
  }

  // Next day — increment.
  if (gap === 1) {
    const next = state.currentDays + 1;
    return {
      currentStreak: next,
      longestDays: Math.max(next, state.longestDays),
      freezesAvailable: state.freezesAvailable,
      freezesUsedThisWeek: state.freezesUsedThisWeek,
      lastActiveDate: today,
      recoveredAt: state.recoveredAt,
      didFreeze: false,
      didRecover: false,
      message: "incremented",
    };
  }

  // 2-day gap with no recovery yet → recover (24h grace window).
  if (gap === 2 && state.recoveredAt !== lastActive) {
    const next = state.currentDays + 1;
    return {
      currentStreak: next,
      longestDays: Math.max(next, state.longestDays),
      freezesAvailable: state.freezesAvailable,
      freezesUsedThisWeek: state.freezesUsedThisWeek,
      lastActiveDate: today,
      recoveredAt: today,
      didFreeze: false,
      didRecover: true,
      message: "recovered_within_24h",
    };
  }

  // 2+ day gap with a freeze available → freeze the streak.
  if (gap >= 2 && state.freezesAvailable > 0) {
    const next = state.currentDays + 1;
    return {
      currentStreak: next,
      longestDays: Math.max(next, state.longestDays),
      freezesAvailable: state.freezesAvailable - 1,
      freezesUsedThisWeek: state.freezesUsedThisWeek + 1,
      lastActiveDate: today,
      recoveredAt: state.recoveredAt,
      didFreeze: true,
      didRecover: false,
      message: "frozen",
    };
  }

  // Otherwise: start a new streak. Today's session is day 1.
  return {
    currentStreak: 1,
    longestDays: Math.max(1, state.longestDays),
    freezesAvailable: state.freezesAvailable,
    freezesUsedThisWeek: state.freezesUsedThisWeek,
    lastActiveDate: today,
    recoveredAt: state.recoveredAt,
    didFreeze: false,
    didRecover: false,
    message: "restarted",
  };
}

/**
 * Whether a 24h recovery is still possible for a given missed day.
 *
 * "Can recover" is true when:
 *   - `today` is exactly 2 days after `lastBrokenDate` (one missed day,
 *     one grace day), AND
 *   - the user has not already used the recovery for that break.
 *
 * Outside that window, the break is permanent (the user can still
 * start a new streak — there's no shame — but the old one is gone).
 */
export function canRecover(args: {
  lastBrokenDate: DateKey;
  today: DateKey;
  /** Date the user last used the recovery; null if never. */
  recoveredAt: DateKey | null;
}): boolean {
  if (args.recoveredAt === args.lastBrokenDate) return false;
  return daysBetween(args.lastBrokenDate, args.today) === 2;
}

/**
 * Days until the streak freeze counter resets for the week.
 *
 * The week resets on the user's local Monday. `weekStart` is the date key
 * for that Monday (`YYYY-MM-DD`). Returns 0–6 inclusive — `0` means
 * "the reset is today".
 */
export function daysUntilFreezeReset(weekStart: DateKey): number {
  const monday = Date.UTC(
    Number(weekStart.slice(0, 4)),
    Number(weekStart.slice(5, 7)) - 1,
    Number(weekStart.slice(8, 10)),
  );
  const now = Date.now();
  // The week-end is the next Monday at UTC midnight.
  const weekEnd = monday + 7 * 86_400_000;
  const diffDays = Math.ceil((weekEnd - now) / 86_400_000);
  if (diffDays <= 0) return 0;
  if (diffDays > 7) return 7;
  return diffDays;
}

/**
 * Helper: given a date key, return the Monday on/before that date. Useful
 * for callers that compute `weekStart` from a "today" they already have.
 */
export function mondayOf(dateKey: DateKey): DateKey {
  const ms = Date.UTC(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
  );
  const d = new Date(ms);
  // `getUTCDay` is 0=Sun..6=Sat; we want Monday. Distance back to Monday:
  const dow = d.getUTCDay();
  const back = (dow + 6) % 7; // 0 if Monday, 1 if Tuesday, … 6 if Sunday
  const monday = new Date(ms - back * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
