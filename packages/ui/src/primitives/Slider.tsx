"use client";

import * as React from "react";
import { cn } from "../cn";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Optional accessible label. */
  ariaLabel?: string;
  /** Optional textual formatter for the value (shown via aria-valuetext). */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/**
 * Minimal accessible range slider built on `role="slider"`. Avoids an
 * a11y-heavy native `<input type="range">` styling dependency.
 * Keyboard: ←/→  ±step · Home/End  jump to min/max ·
 * PageUp/PageDown  ±(max-min)*0.1.
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  formatValue,
  disabled = false,
  className,
}) => {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const range = safeMax - safeMin || 1;
  const pct = Math.max(0, Math.min(100, ((value - safeMin) / range) * 100));

  const clamp = (v: number): number =>
    Math.max(safeMin, Math.min(safeMax, v));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next = value;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = clamp(value + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = clamp(value - step);
        break;
      case "Home":
        next = safeMin;
        break;
      case "End":
        next = safeMax;
        break;
      case "PageUp":
        next = clamp(value + range * 0.1);
        break;
      case "PageDown":
        next = clamp(value - range * 0.1);
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={safeMin}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      aria-valuetext={formatValue ? formatValue(value) : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative h-10 w-full cursor-pointer touch-none select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <div className="absolute inset-y-0 left-0 right-0 my-auto h-1 rounded-full bg-border" />
      <div
        className="absolute inset-y-0 left-0 my-auto h-1 rounded-full bg-coral-bg transition-[width] duration-fast ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className={cn(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-coral-bg bg-card shadow-sm transition-transform duration-fast ease-out",
          "group-hover:scale-110 group-focus-visible:scale-110",
        )}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
};

Slider.displayName = "Slider";