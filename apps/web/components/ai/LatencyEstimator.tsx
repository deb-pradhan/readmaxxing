"use client";

/**
 * LatencyEstimator — honest time-based progress for AI operations.
 *
 * Per UI-UX.md §7: "if something takes > 2s, show a calm status with an
 * estimated time, not an indeterminate spinner. Predictability reduces
 * perceived wait." The estimator just counts up from the call start, with a
 * short copy that pre-honest the user about expected duration so they don't
 * bail when the model takes 8s.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface LatencyEstimatorProps {
  /** Wall-clock start of the operation, in epoch ms. */
  startMs: number;
  /** Calming, honest copy (e.g. "Usually takes 3-10 seconds…"). */
  message?: string;
  className?: string;
  /** Tick interval in ms. Default 500. */
  tickMs?: number;
}

export function LatencyEstimator({
  startMs,
  message = "Usually takes 3-10 seconds…",
  className,
  tickMs = 500,
}: LatencyEstimatorProps): React.JSX.Element {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const elapsedMs = Math.max(0, now - startMs);
  const elapsedSeconds = Math.round(elapsedMs / 1000);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm", className)}
    >
      <span className="text-ink-muted">{message}</span>
      <span aria-hidden className="tabular text-ink-muted">
        {elapsedSeconds}s elapsed
      </span>
    </div>
  );
}
