"use client";

/**
 * SpeedControl — preset chips + custom slider for fine control.
 *
 * Per UI-UX.md §4.6: 0.5×–4.5×, pitch-preserved. Defaults to 1×, remembered
 * per-doc/per-user (per-user via `user-preferences` IndexedDB store; per-doc
 * via the position.speed on save).
 *
 * Quick-tap presets come from `@readmaxxing/config` (1×, 1.25×, 1.5×, 2×, 3×).
 * The slider covers the full 0.5× – 4.5× range for power users.
 */

import * as React from "react";
import { QUICK_TAP_SPEEDS, MIN_SPEED, MAX_SPEED } from "@readmaxxing/config";
import { cn } from "@readmaxxing/ui";

export interface SpeedControlProps {
  value: number;
  onChange: (next: number) => void;
  /** When true, show the custom slider below the chips. */
  showCustom?: boolean;
  className?: string;
}

export function SpeedControl({
  value,
  onChange,
  showCustom = true,
  className,
}: SpeedControlProps): React.JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="group"
        aria-label="Playback speed"
        className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-card-muted p-1"
      >
        {QUICK_TAP_SPEEDS.map((preset) => {
          const active = Math.abs(value - preset) < 0.01;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-pressed={active}
              className={cn(
                "tabular min-w-[3rem] rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-fast ease-out",
                "focus-visible:outline-none focus-visible:shadow-focus",
                active
                  ? "bg-accent text-white"
                  : "text-ink-muted hover:bg-card",
              )}
            >
              {preset}×
            </button>
          );
        })}
      </div>
      {showCustom ? (
        <label className="flex flex-col gap-1">
          <span className="tabular text-xs uppercase tracking-widest text-ink-muted">
            Fine control · {value.toFixed(2)}×
          </span>
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.05}
            value={value}
            onChange={(e) => onChange(Number(e.currentTarget.value))}
            aria-label="Custom playback speed"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border-subtle accent-accent focus-visible:outline-none focus-visible:shadow-focus"
          />
        </label>
      ) : null}
    </div>
  );
}