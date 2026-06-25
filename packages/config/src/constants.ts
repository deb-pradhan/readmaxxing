/**
 * ReadMaxxing — app-wide constants.
 *
 * Speed presets per UI-UX.md §4.6: 0.5×–4.5×, pitch-preserved. Default 1×.
 * The UI exposes a quick-tap list (1×, 1.25×, 1.5×, 2×, 3×) with a long-press
 * to dial a custom speed.
 *
 * XP values per action back the Phase 5.5 habit layer.
 */

/** Speed presets exposed in the player speed menu. */
export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];

/** Quick-tap speed set (subset surfaced as one-tap buttons in the player). */
export const QUICK_TAP_SPEEDS: SpeedPreset[] = [1, 1.25, 1.5, 2, 3];

export const DEFAULT_SPEED: SpeedPreset = 1;

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 4.5;

/** Word counts per minute — basis for read-time and progress estimates. */
export const WORDS_PER_MINUTE = 155;

/** Scratch defaults for new users — applied to IndexedDB user-preferences. */
export const DEFAULT_THEME = "light" as const;
export const DEFAULT_FONT = "serif" as const;

/**
 * XP awarded per source. Variable-reward multipliers (1.0× – 2.0×) are
 * applied at runtime; these are the base values.
 */
export const XP_VALUES = {
  readingMinute: 5,
  listeningMinute: 5,
  quizCorrect: 10,
  quizFullStreak: 50,
  podcastMinute: 7,
  voiceTypingMinute: 3,
  ocrPage: 15,
  share: 25,
  streakDailyBonus: 30,
  dailyGoalComplete: 50,
} as const;

export const XP_SOURCE = {
  reading: "reading",
  listening: "listening",
  quiz: "quiz",
  podcast: "podcast",
  voiceTyping: "voice_typing",
  ocr: "ocr",
  share: "share",
  streakBonus: "streak_bonus",
  dailyGoalBonus: "daily_goal_bonus",
  milestoneBonus: "milestone_bonus",
} as const;

export type XpSource = (typeof XP_SOURCE)[keyof typeof XP_SOURCE];

/** Daily-goal defaults (user-editable later). */
export const DEFAULT_DAILY_GOAL_MINUTES = 15;

/** Privy cookie names (read by middleware). */
export const PRIVY_COOKIE = "privy-token";

/** Allowed CORS / redirect origins for the BFF. */
export const ALLOWED_REDIRECT_ORIGINS = [
  "http://localhost:3000",
  "https://readmaxxing.app",
] as const;

/** Cache TTLs for BFF responses (seconds). */
export const CACHE_TTL = {
  voiceCatalog: 60 * 60, // 1h — voice catalog rarely changes
  documentSummary: 60 * 5, // 5m
  playbackPosition: 0, // never cache — always live
} as const;