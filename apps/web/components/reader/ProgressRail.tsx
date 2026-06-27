"use client";

/**
 * ProgressRail — thin top bar + "X% · Y min left" readout.
 *
 * Per DESIGN-SYSTEM §5: endowed-progress pattern. The bar is thin
 * (≤ 4px) and the readout uses tabular figures so the number doesn't
 * jitter as it ticks. Coral fill on a muted track.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface ProgressRailProps {
  /** 0–100. */
  percent: number;
  /** Minutes left (rounded). */
  minutesLeft: number;
  className?: string;
}

export function ProgressRail({
  percent,
  minutesLeft,
  className,
}: ProgressRailProps): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      aria-label="Reading progress"
      className={cn("pointer-events-none fixed inset-x-0 top-0 z-sticky", className)}
    >
      <div className="h-1 w-full overflow-hidden bg-border-subtle">
        <div
          aria-hidden
          className="h-full bg-coral-bg transition-[width] duration-fast ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        aria-live="polite"
        className="tabular pointer-events-none absolute right-4 top-1 rounded-md bg-card/95 px-2 py-0.5 text-xs text-ink-muted shadow-sm backdrop-blur-md"
      >
        {Math.round(pct)}% · {minutesLeft} min left
      </p>
    </div>
  );
}