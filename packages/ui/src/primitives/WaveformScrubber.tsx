"use client";

/**
 * WaveformScrubber — visual audio scrubber (DESIGN-SYSTEM §25.8).
 *
 * Replaces the native `<input type="range">` rail with a stylized
 * waveform: vertical bars per "peak" sample, played = ink, upcoming =
 * ink @ 24%, playhead = coral, optional mono timecode bubble above.
 *
 * Click-to-seek: the user clicks (or drags) anywhere along the strip
 * and we compute the corresponding time via the `onSeek` callback.
 * Falls back to a static hairline progress bar when no peaks are
 * available — same width/height so the layout doesn't jump.
 *
 * Honors `prefers-reduced-motion`: the hover-played-bar animation is
 * gated on it, and when reduced motion is on, click-to-seek still
 * works but the playhead snaps instead of animating.
 */

import * as React from "react";
import { cn } from "../cn";

export interface WaveformScrubberProps {
  /** Current playback time (seconds). */
  currentTime: number;
  /** Total duration (seconds). 0 = unknown / not loaded. */
  duration: number;
  /**
   * Optional precomputed peaks (0..1). When omitted, we render a
   * static fallback hairline progress bar so callers don't have to
   * special-case the no-audio state.
   */
  peaks?: number[] | null;
  /** Click / drag handler — receives the seek target (seconds). */
  onSeek?: (timeSeconds: number) => void;
  /** Accessible label override; defaults to a timecoded label. */
  "aria-label"?: string;
  /** Pixel height for the strip. */
  height?: number;
  className?: string;
  /** Disable interaction (purely decorative). */
  readOnly?: boolean;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Probe `prefers-reduced-motion`. SSR-safe — returns `false` during
 * server render and the real value after hydration. The CSS layer
 * also gates the animations, but we use this in `aria-pressed` and
 * to skip the JS animation work entirely.
 */
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

/** Deterministic pseudo-peaks (so a strip without real data still looks alive). */
function fallbackPeaks(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // A simple wobble between 0.35 and 0.95 so the bars read as audio.
    const t = (i / count) * Math.PI * 8;
    const v = 0.55 + 0.35 * Math.sin(t) + 0.1 * Math.cos(t * 2.3);
    out.push(Math.max(0.15, Math.min(1, v)));
  }
  return out;
}

export function WaveformScrubber({
  currentTime,
  duration,
  peaks,
  onSeek,
  "aria-label": ariaLabel,
  height = 28,
  className,
  readOnly = false,
}: WaveformScrubberProps): React.JSX.Element {
  const reduced = usePrefersReducedMotion();
  const trackRef = React.useRef<HTMLButtonElement | null>(null);
  const draggingRef = React.useRef(false);

  const safeDuration = Math.max(0, duration);
  const safeCurrent = Math.max(0, Math.min(currentTime, safeDuration || currentTime));
  const ratio = safeDuration > 0 ? safeCurrent / safeDuration : 0;
  const playheadPct = Math.max(0, Math.min(1, ratio)) * 100;

  const hasPeaks = Array.isArray(peaks) && peaks.length > 0;
  const data = hasPeaks ? (peaks as number[]) : fallbackPeaks(56);

  const label =
    ariaLabel ??
    `Audio progress: ${formatTime(safeCurrent)} of ${formatTime(safeDuration)}`;

  function timeFromClient(clientX: number): number {
    const el = trackRef.current;
    if (!el || safeDuration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (x / rect.width) * safeDuration;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    if (readOnly || !onSeek || safeDuration <= 0) return;
    draggingRef.current = true;
    const target = e.currentTarget;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom / older browsers may throw — capture is best-effort */
    }
    onSeek(timeFromClient(e.clientX));
  }
  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || !onSeek) return;
    onSeek(timeFromClient(e.clientX));
  }
  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>): void {
    draggingRef.current = false;
    const target = e.currentTarget;
    try {
      target.releasePointerCapture?.(e.pointerId);
    } catch {
      /* best-effort */
    }
    if (onSeek) onSeek(timeFromClient(e.clientX));
  }

  // Mouse fallback. Some test environments (jsdom) and older browsers
  // don't synthesize pointer events; we still want click-to-seek to
  // work there. Real users get pointer events on every modern engine.
  function handleMouseDown(e: React.MouseEvent<HTMLButtonElement>): void {
    if (readOnly || !onSeek || safeDuration <= 0) return;
    draggingRef.current = true;
    onSeek(timeFromClient(e.clientX));
  }
  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || !onSeek) return;
    onSeek(timeFromClient(e.clientX));
  }
  function handleMouseUp(e: React.MouseEvent<HTMLButtonElement>): void {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (onSeek) onSeek(timeFromClient(e.clientX));
  }
  function handleMouseLeave(): void {
    draggingRef.current = false;
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (readOnly || !onSeek || safeDuration <= 0) return;
    const step = safeDuration * 0.02; // 2% nudge
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.min(safeDuration, safeCurrent + step));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.max(0, safeCurrent - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(safeDuration);
    }
  }

  return (
    <button
      ref={trackRef}
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration)}
      aria-valuenow={Math.round(safeCurrent)}
      aria-valuetext={`${formatTime(safeCurrent)} / ${formatTime(safeDuration)}`}
      data-playing={hasPeaks ? "true" : "false"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      disabled={readOnly}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-md",
        "focus-visible:outline-none focus-visible:shadow-focus",
        !readOnly && "cursor-pointer",
        readOnly && "cursor-default",
        className,
      )}
      style={{ height: `${height}px` }}
    >
      <span
        aria-hidden
        className="pointer-events-none relative flex-1 overflow-hidden rounded-full bg-border-subtle"
        style={{ height: `${height}px` }}
      >
        {/* Bar track */}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-between px-[2px]"
        >
          {data.map((peak, i) => {
            const idxRatio = i / data.length;
            const played = idxRatio <= ratio;
            const barH = Math.max(2, Math.round(peak * (height - 4)));
            return (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "block w-[2px] rounded-full transition-colors duration-fast",
                  played ? "bg-ink" : "bg-ink/30",
                  // Reduced motion: no hover wiggle. When playing AND
                  // not reduced, the upcoming bars shift their opacity
                  // subtly so the strip feels alive.
                  !reduced && !played && "group-hover:bg-ink/40",
                )}
                style={{
                  height: `${barH}px`,
                }}
              />
            );
          })}
        </span>

        {/* Playhead — coral circle that snaps over the active bar */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2",
            "rounded-full bg-coral-bg shadow-[0_0_0_2px_rgba(255,255,255,0.6)]",
            !reduced && "transition-[left] duration-fast ease-out",
          )}
          style={{ left: `${playheadPct}%` }}
        />
      </span>
    </button>
  );
}