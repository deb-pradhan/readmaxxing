"use client";

/**
 * StreakRing — Phase 5.5 placeholder.
 *
 * The habit/streak UI is out of scope for Phase 1 (the DB tables exist in
 * `packages/db/prisma/schema.prisma`). This primitive renders a clean ring
 * placeholder so the player page and library shelves can reference it
 * without dragging in logic. Phase 5.5 replaces the body with the real
 * streak ring + at-risk messaging.
 */

import * as React from "react";
import { cn } from "../cn";

export interface StreakRingProps {
  /** Current streak days — `0` renders the empty state. */
  days: number;
  /** Goal days — drives the ring fill (UI-UX.md §8). */
  goal?: number;
  className?: string;
}

export function StreakRing({ days, goal = 7, className }: StreakRingProps) {
  const pct = Math.min(1, Math.max(0, days / goal));
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={`${days}-day streak (goal ${goal})`}
      className={cn("inline-flex h-14 w-14 items-center justify-center", className)}
    >
      <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--color-accent, #5B4DEF)"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="tabular absolute text-sm font-semibold">{days}</span>
    </div>
  );
}