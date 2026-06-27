"use client";

/**
 * StreakRing — circular SVG ring with a flame icon.
 *
 * Per DESIGN-SYSTEM §14: a small KPI tile + ring fill. When the user
 * hasn't read today and it's after 4pm local time the ring glows
 * amber (the "at risk" state). Never red — pressure-without-shame.
 */

import * as React from "react";
import { cn } from "../cn";

export interface StreakRingProps {
  /** Current streak days. `0` renders the empty state. */
  days: number;
  /** Goal days — drives the ring fill. */
  goal?: number;
  /** Whether the user has hit the daily goal today. */
  todayActive?: boolean;
  /** Whether it's past 4pm local — drives the "at risk" glow. */
  atRisk?: boolean;
  /** Size in pixels. */
  size?: number;
  /** Animate the fill when `days` changes. */
  animated?: boolean;
  className?: string;
}

export function StreakRing({
  days,
  goal = 7,
  todayActive = false,
  atRisk = false,
  size = 72,
  animated = true,
  className,
}: StreakRingProps): React.JSX.Element {
  const r = 28;
  const c = 2 * Math.PI * r;
  const targetPct = Math.min(1, Math.max(0, days / goal));
  const [displayPct, setDisplayPct] = React.useState(targetPct);

  // Animate to the new pct over 480ms when `days` changes (DESIGN-SYSTEM
  // §10.4 — deliberate timing for KPI updates).
  React.useEffect(() => {
    if (!animated) {
      setDisplayPct(targetPct);
      return;
    }
    const start = displayPct;
    const delta = targetPct - start;
    if (Math.abs(delta) < 0.001) return;
    const startTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / 480);
      // ease-out cubic.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(start + delta * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPct, animated]);

  const atRiskGlow = atRisk && !todayActive;
  const ringColor = atRiskGlow ? "#C97A0F" : "#FF5C44";

  return (
    <div
      role="img"
      aria-label={`${days}-day streak${atRiskGlow ? " — at risk" : ""}`}
      data-state={atRiskGlow ? "at-risk" : todayActive ? "active" : "idle"}
      className={cn(
        "relative inline-flex items-center justify-center",
        atRiskGlow && "drop-shadow-[0_0_8px_rgba(201,122,15,0.4)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 72 72"
        width={size}
        height={size}
        aria-hidden
        className={atRiskGlow ? "animate-[pulse_2.4s_ease-in-out_infinite]" : undefined}
      >
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - displayPct)}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <FlameIcon cx={36} cy={32} size={22} color={ringColor} />
      </svg>
      <span
        className={cn(
          "absolute bottom-1 left-1/2 -translate-x-1/2 tabular text-sm font-semibold",
          atRiskGlow ? "text-warning" : "text-ink",
        )}
      >
        {days}
      </span>
    </div>
  );
}

function FlameIcon({
  cx,
  cy,
  size,
  color,
}: {
  cx: number;
  cy: number;
  size: number;
  color: string;
}): React.JSX.Element {
  return (
    <g>
      <path
        d={`M${cx} ${cy - size / 2}
            C ${cx + size / 2} ${cy - size / 4}, ${cx + size / 2} ${cy + size / 4}, ${cx} ${cy + size / 2}
            C ${cx - size / 2} ${cy + size / 4}, ${cx - size / 2} ${cy - size / 4}, ${cx} ${cy - size / 2} Z`}
        fill={color}
        opacity="0.85"
      />
      <path
        d={`M${cx} ${cy - size / 4}
            C ${cx + size / 3} ${cy}, ${cx + size / 3} ${cy + size / 3}, ${cx} ${cy + size / 2 - 1}
            C ${cx - size / 3} ${cy + size / 3}, ${cx - size / 3} ${cy}, ${cx} ${cy - size / 4} Z`}
        fill="#FFEFC5"
        opacity="0.5"
      />
    </g>
  );
}