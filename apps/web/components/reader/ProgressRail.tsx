"use client";

/**
 * ProgressRail — thin top bar + "X% · Y min left" readout.
 *
 * Per DESIGN-SYSTEM §5: endowed-progress pattern. The bar is thin
 * (≤ 4px) and the readout uses tabular figures so the number doesn't
 * jitter as it ticks. Coral fill on a muted track.
 *
 * Phase F (F.8): the bar is now a WaveformScrubber so the user can
 * jump to a position by clicking along the strip. When `onSeek`
 * isn't supplied the scrubber renders read-only (decorative).
 */

import * as React from "react";
import { WaveformScrubber, cn } from "@readmaxxing/ui";

export interface ProgressRailProps {
  /** 0–100. */
  percent: number;
  /** Minutes left (rounded). */
  minutesLeft: number;
  /** Click / drag handler — seek by percent. */
  onSeek?: (percent: number) => void;
  className?: string;
}

export function ProgressRail({
  percent,
  minutesLeft,
  onSeek,
  className,
}: ProgressRailProps): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, percent));
  // The scrubber's API is time-based; the rail is percent-based. We
  // convert on the boundary so the scrubber stays a clean primitive
  // (no second meaning of "duration").
  return (
    <div
      aria-label="Reading progress"
      className={cn(
        "pointer-events-auto fixed inset-x-0 top-0 z-sticky",
        className,
      )}
    >
      <WaveformScrubber
        currentTime={pct}
        duration={100}
        onSeek={
          onSeek
            ? (t) => onSeek(Math.max(0, Math.min(100, t)))
            : undefined
        }
        readOnly={!onSeek}
        height={4}
        aria-label={`Reading progress: ${Math.round(pct)}%, ${minutesLeft} minutes left`}
      />
      <p
        aria-live="polite"
        className="tabular pointer-events-none absolute right-4 top-1 rounded-md bg-card/95 px-2 py-0.5 text-xs text-ink-muted shadow-sm backdrop-blur-md"
      >
        {Math.round(pct)}% · {minutesLeft} min left
      </p>
    </div>
  );
}