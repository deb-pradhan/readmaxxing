"use client";

/**
 * XPBar — daily-goal XP ring + level progress.
 *
 * Per DESIGN-SYSTEM §14 (data viz):
 * - Left: today's XP / daily-goal ring (coral on light, mint on
 *   completion).
 * - Right: lifetime XP progress toward the next level.
 */

import * as React from "react";
import { cn } from "../cn";

export interface XPBarProps {
  /** XP earned today. */
  todayXp: number;
  /** Daily goal in XP. */
  dailyGoalXp: number;
  /** Lifetime XP (used for level). */
  totalXp: number;
  /** XP required for the current level. */
  currentLevelXp: number;
  /** XP required for the next level. */
  nextLevelXp: number;
  /** Current level (1-indexed). */
  level: number;
  /** Reason the last XP was awarded, for the "why?" tooltip. */
  lastMultiplierReason?: string;
  className?: string;
}

export function XPBar({
  todayXp,
  dailyGoalXp,
  totalXp,
  currentLevelXp,
  nextLevelXp,
  level,
  lastMultiplierReason,
  className,
}: XPBarProps): React.JSX.Element {
  const dailyPct = Math.min(1, Math.max(0, todayXp / Math.max(1, dailyGoalXp)));
  const levelPct = Math.min(
    1,
    Math.max(0, (totalXp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)),
  );

  return (
    <section
      aria-label="Daily XP and level progress"
      className={cn("rounded-lg border border-border-subtle bg-card p-4 shadow-sm", className)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DailyRing pct={dailyPct} todayXp={todayXp} dailyGoalXp={dailyGoalXp} />
        <LevelBar
          level={level}
          pct={levelPct}
          totalXp={totalXp}
          currentLevelXp={currentLevelXp}
          nextLevelXp={nextLevelXp}
        />
      </div>
      {lastMultiplierReason ? (
        <p className="mt-3 text-xs text-ink-muted">+ {lastMultiplierReason}</p>
      ) : null}
    </section>
  );
}

function DailyRing({
  pct,
  todayXp,
  dailyGoalXp,
}: {
  pct: number;
  todayXp: number;
  dailyGoalXp: number;
}): React.JSX.Element {
  const r = 24;
  const c = 2 * Math.PI * r;
  const color = pct >= 1 ? "#1F9E5A" : "#FF5C44";
  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex h-16 w-16 items-center justify-center" aria-hidden>
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="absolute tabular text-sm font-semibold">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Today's goal</p>
        <p className="tabular text-xs text-ink-muted">
          {todayXp.toLocaleString()} / {dailyGoalXp.toLocaleString()} XP
        </p>
        {pct >= 1 ? (
          <p className="mt-1 text-xs text-success">Goal met — streak protected.</p>
        ) : null}
      </div>
    </div>
  );
}

function LevelBar({
  level,
  pct,
  totalXp,
  currentLevelXp,
  nextLevelXp,
}: {
  level: number;
  pct: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">Level {level}</span>
        <span className="tabular text-ink-muted">
          {totalXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-card-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-coral-bg"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {(nextLevelXp - totalXp).toLocaleString()} XP to level {level + 1}
      </p>
    </div>
  );
}