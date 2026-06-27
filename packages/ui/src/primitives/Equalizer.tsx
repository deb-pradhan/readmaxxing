"use client";

/**
 * Equalizer — animated 3-bar equalizer (DESIGN-SYSTEM §25.8).
 *
 * A tiny visual cue that the player is actually playing. Three bars
 * pulse on staggered `rAF` loops; when `playing` is false (or the user
 * has `prefers-reduced-motion`), the bars render at a calm resting
 * height instead of animating — no jarring freezes, no overpainted
 * CSS shimmer.
 *
 * Token-only: uses `currentColor` so the parent controls the hue
 * (default ink, can be coral via `text-coral-text`). Two sizes (16/20)
 * keep the element useful for both the reader toolbar and the
 * PlayerBar's now-playing hero card.
 */

import * as React from "react";
import { cn } from "../cn";

export interface EqualizerProps {
  /** Whether the player is currently playing. */
  playing: boolean;
  /** Pixel size (square footprint). */
  size?: 16 | 20;
  /** Override the bar color. Defaults to `currentColor`. */
  className?: string;
  /** Accessible label override. */
  "aria-label"?: string;
}

/** Probe `prefers-reduced-motion` — SSR-safe. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Self-driving 3-bar equalizer. We render three independent bars and
 * animate their heights via `rAF`. Each bar gets a phase offset so
 * the three look staggered, not synchronized.
 */
export const Equalizer = React.forwardRef<HTMLSpanElement, EqualizerProps>(
  function Equalizer(
    { playing, size = 16, className, "aria-label": ariaLabel },
    ref,
  ) {
    const reduced = usePrefersReducedMotion();
    const animating = playing && !reduced;
    const [heights, setHeights] = React.useState<[number, number, number]>([
      0.4, 0.4, 0.4,
    ]);
    const rafRef = React.useRef<number | null>(null);
    const startRef = React.useRef<number>(0);

    React.useEffect(() => {
      if (!animating) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        // Resting heights — small, even, no jitter.
        setHeights([0.35, 0.35, 0.35]);
        return;
      }

      const phases: [number, number, number] = [0, 1.6, 3.2];
      const tick = (t: number): void => {
        const elapsed = (t - startRef.current) / 1000;
        const next: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < 3; i++) {
          const p = phases[i] ?? 0;
          // 1.2 Hz oscillation between 0.25 and 1.0.
          const v = 0.625 + 0.375 * Math.sin(elapsed * 1.2 * Math.PI + p);
          next[i] = Math.max(0.2, Math.min(1, v));
        }
        setHeights(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }, [animating]);

    const barWidth = size <= 16 ? 2 : 2.5;
    const gap = size <= 16 ? 1.5 : 2;

    return (
      <span
        ref={ref}
        role="presentation"
        aria-hidden={ariaLabel ? undefined : "true"}
        aria-label={ariaLabel}
        data-playing={playing ? "true" : "false"}
        data-reduced-motion={reduced ? "true" : "false"}
        className={cn(
          "inline-flex items-end justify-center text-coral-text",
          className,
        )}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          gap: `${gap}px`,
        }}
      >
        {[0, 1, 2].map((i) => {
          const h = heights[i] ?? 0.35;
          return (
            <span
              key={i}
              aria-hidden
              className="block rounded-full bg-current"
              style={{
                width: `${barWidth}px`,
                height: `${Math.max(0.18, h) * size}px`,
              }}
            />
          );
        })}
      </span>
    );
  },
);