"use client";

/**
 * PlayerBar — persistent bottom chrome + hero now-playing card.
 *
 * Per DESIGN-SYSTEM §25.6 + §25.7 + §25.8:
 *   - Two variants:
 *       "mini" — the persistent bottom bar. Play/Pause + scrubber
 *         + time. Small, calm, never the loudest element.
 *       "hero" — the now-playing surface that surfaces when a doc
 *         is playing AND the user expands it. The hero card uses
 *         the sanctioned surface→muted gradient (DESIGN-SYSTEM
 *         §25.3 — exactly ONE gradient allowed in the codebase,
 *         and it lives here).
 *   - Both variants use the mono timecode (Phase E E.9), the
 *     WaveformScrubber (Phase F F.8), and the Equalizer (Phase F
 *     F.7). Both honor `prefers-reduced-motion` (the Equalizer's
 *     rAF gates on it; the scrubber's playhead transition gates on
 *     it; the gradient is static).
 *
 * The `expanded` flag is local UI state — controlled by the user
 * tapping the top timecode chip. Phase D shipped the expand button
 * as the chrome's primary affordance; v2 keeps it.
 */

import * as React from "react";
import { SPEED_PRESETS, QUICK_TAP_SPEEDS } from "@readmaxxing/config";
import {
  Button,
  CoverArt,
  DropdownMenu,
  Equalizer,
  WaveformScrubber,
  cn,
} from "@readmaxxing/ui";
import { SpeedControl } from "./SpeedControl";

export interface PlayerBarProps {
  /** Document title — surfaced at the top of the bar. */
  title: string;
  /** Playing state. */
  playing: boolean;
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total duration in seconds. */
  duration: number;
  /** Current speed. */
  speed: number;
  /** Loading flag. */
  loading?: boolean;
  /** Error message (DESIGN-SYSTEM §17.3 — human + actionable). */
  errorMessage?: string | null;
  /** Voice label. */
  voiceLabel?: string;
  /** Open the voice picker sheet. */
  onOpenVoices?: () => void;
  /** Open the keyboard shortcuts sheet. */
  onShowHelp?: () => void;
  /** Open the speed menu / sheet. */
  onShowSpeedMenu?: () => void;
  /** Show the speed control inline (when expanded). */
  showSpeedInline?: boolean;
  /** Toggle sleep timer. */
  onSleepTimer?: () => void;
  /** Toggle skip fillers. */
  onSkipFillers?: () => void;
  /** Play / pause toggle. */
  onPlayPause: () => void;
  /** Seek to a time in seconds. */
  onSeek: (timeSeconds: number) => void;
  /** Speed change. */
  onSpeedChange: (next: number) => void;
  /** Accessibility label for the play/pause button. */
  playPauseLabel?: string;
  /**
   * Phase F (F.5): variant. "mini" (default) renders the compact
   * bottom bar. "hero" renders the now-playing card with the
   * sanctioned gradient + cover + Display-2 title.
   */
  variant?: "mini" | "hero";
  /** Optional seed for the cover (defaults to the title). */
  coverSeed?: string;
  className?: string;
}

const SEEK_STEP_SECONDS = 15;
const SEEK_BIG_SECONDS = 30;

export function PlayerBar({
  title,
  playing,
  currentTime,
  duration,
  speed,
  loading = false,
  errorMessage = null,
  voiceLabel,
  onOpenVoices,
  onShowHelp,
  onShowSpeedMenu,
  showSpeedInline = false,
  onSleepTimer,
  onSkipFillers,
  onPlayPause,
  onSeek,
  onSpeedChange,
  playPauseLabel,
  variant = "mini",
  coverSeed,
  className,
}: PlayerBarProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);

  const safeDuration = Math.max(0, duration);
  const safeCurrent = Math.max(0, Math.min(currentTime, safeDuration || currentTime));
  const percent =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (safeCurrent / safeDuration) * 100))
      : 0;
  const remaining = Math.max(0, Math.round(safeDuration - safeCurrent));

  function nudge(deltaSeconds: number): void {
    const next = Math.max(0, Math.min(safeDuration, safeCurrent + deltaSeconds));
    onSeek(next);
  }

  const menuItems: Array<{
    label: string;
    onSelect?: () => void;
  }> = [
    { label: "Speed presets…", onSelect: onShowSpeedMenu },
    { label: "Voice…", onSelect: onOpenVoices },
    { label: "Sleep timer", onSelect: onSleepTimer },
    { label: "Skip fillers", onSelect: onSkipFillers },
    { label: "Keyboard shortcuts (?)", onSelect: onShowHelp },
  ];

  // Phase F (F.5): the hero variant is the only place the codebase
  // is allowed to use a gradient. The gradient is the sanctioned
  // surface→muted wash from DESIGN-SYSTEM §25.3 (white → cream). It
  // is rendered as a static inline style with CSS variables so themes
  // (esp. eink) remap it automatically. No hex fallback — the theme
  // layer guarantees both vars resolve; if a theme forgets to set
  // them, the gradient simply doesn't render (no hardcoded color
  // ships with the code).
  const heroGradient: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(to bottom, var(--surface), var(--surface-muted))",
  };

  // When the hero variant is active we ALSO render the mini bar at
  // the bottom (mini-player chrome); the hero card sits above the
  // page content so the user can dismiss it by tapping the close
  // affordance. This keeps the bar's persistent role intact.
  if (variant === "hero") {
    return (
      <section
        role="region"
        aria-label="Now playing"
        data-variant="hero"
        data-playing={playing ? "true" : "false"}
        className={cn(
          "fixed inset-x-0 bottom-0 z-sticky overflow-hidden",
          "border-t border-border-subtle shadow-elev-2",
          className,
        )}
        style={heroGradient}
      >
        <div className="mx-auto flex w-full max-w-3xl items-stretch gap-5 p-5 sm:p-6">
          <CoverArt
            seed={coverSeed ?? title}
            title={title}
            aspect="3/4"
            className="hidden h-32 w-24 shrink-0 rounded-card sm:block"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
              Now playing
            </p>
            <h2 className="line-clamp-2 break-words text-[clamp(22px,5vw,32px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">
              {title}
            </h2>
            <p className="text-sm text-ink-muted">
              {voiceLabel ?? "Default voice"} · {formatRemaining(remaining)} left
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onPlayPause}
                aria-label={playing ? "Pause" : "Continue listening"}
              >
                {loading ? "Loading…" : playing ? "Pause" : "Continue listening"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={onOpenVoices}>
                Change voice
              </Button>
              <div className="ml-auto flex items-center gap-1.5 text-sm text-ink-muted">
                <Equalizer playing={playing} size={16} aria-label="Playing" />
                <span className="font-mono tabular-nums">
                  {displayTimeFmt(safeCurrent)} / {displayTimeFmt(safeDuration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default mini variant.
  return (
    <section
      role="region"
      aria-label="Player"
      data-variant="mini"
      data-playing={playing ? "true" : "false"}
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky border-t border-border-subtle bg-card/95 backdrop-blur-md",
        "shadow-lg",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="player-bar-menu"
        className="flex w-full items-center gap-2 px-4 pt-2 text-left text-xs text-ink-muted focus-visible:outline-none focus-visible:shadow-focus"
      >
        <span className="font-mono tabular-nums text-ink">
          {displayTimeFmt(safeCurrent)}
        </span>
        <span className="px-2 text-ink-faint">/</span>
        <span className="font-mono tabular-nums">
          {displayTimeFmt(safeDuration)}
        </span>
        <span className="px-2 text-ink-faint">·</span>
        <span className="truncate text-sm text-ink">{title}</span>
        {/* Phase F (F.7): Equalizer replaces the old caret / text
            affordance. Animates only when playing AND not
            prefers-reduced-motion. */}
        <Equalizer
          playing={playing}
          size={16}
          className="ml-2"
          aria-label={playing ? "Playing" : "Paused"}
        />
        <span className="ml-auto">{expanded ? "▾" : "▴"}</span>
      </button>

      <div className="mx-auto flex max-w-reading items-center gap-3 px-4 pb-3 pt-2">
        <button
          type="button"
          onClick={() => nudge(-SEEK_BIG_SECONDS)}
          aria-label="Back 30 seconds (Shift+Left)"
          className="tabular hidden h-11 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          ⟨30
        </button>
        <button
          type="button"
          onClick={() => nudge(-SEEK_STEP_SECONDS)}
          aria-label="Back 15 seconds (Left)"
          className="tabular hidden h-11 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          ⟨15
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playPauseLabel ?? (playing ? "Pause" : "Play")}
          className={cn(
            "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            "bg-coral-600 text-white transition-transform duration-fast ease-out",
            "hover:scale-[1.03] active:scale-[0.97] focus-visible:shadow-focus",
          )}
        >
          {loading ? (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"
            />
          ) : playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <button
          type="button"
          onClick={() => nudge(SEEK_STEP_SECONDS)}
          aria-label="Forward 15 seconds (Right)"
          className="tabular hidden h-11 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          15⟩
        </button>
        <button
          type="button"
          onClick={() => nudge(SEEK_BIG_SECONDS)}
          aria-label="Forward 30 seconds (Shift+Right)"
          className="tabular hidden h-11 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          30⟩
        </button>

        {/* Phase F (F.8): WaveformScrubber replaces the old native
            range input. Click / drag to seek; falls back to a
            synthetic peak set when no audio peaks are supplied. */}
        <WaveformScrubber
          currentTime={safeCurrent}
          duration={safeDuration}
          onSeek={onSeek}
          className="min-w-0 flex-1"
          aria-label="Seek"
        />

        <span
          aria-hidden
          className="font-mono tabular-nums hidden text-sm text-ink-muted md:inline"
        >
          {Math.round(percent)}%
        </span>

        <DropdownMenu
          align="end"
          trigger={
            <button
              type="button"
              aria-label="Player menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border-subtle bg-card text-ink-muted hover:bg-card-muted focus-visible:shadow-focus"
            >
              <span aria-hidden className="text-lg">⋯</span>
            </button>
          }
          items={menuItems.map((m) => ({
            label: m.label,
            onSelect: m.onSelect,
          }))}
        />
      </div>

      {expanded ? (
        <div
          id="player-bar-menu"
          className="mx-auto flex max-w-reading flex-col gap-3 border-t border-border-subtle px-4 py-3"
        >
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="font-mono tabular-nums text-xs uppercase tracking-widest text-ink-muted">
              {speed.toFixed(2)}×
            </span>
            {voiceLabel ? (
              <span className="font-mono tabular-nums text-xs">
                · {voiceLabel}
              </span>
            ) : null}
          </div>
          <SpeedControl value={speed} onChange={onSpeedChange} showCustom={showSpeedInline} />
          <div className="flex flex-wrap gap-2">
            {SPEED_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSpeedChange(p)}
                className={cn(
                  "font-mono tabular-nums rounded-md border border-border-subtle px-2 py-1 text-xs",
                  Math.abs(speed - p) < 0.01
                    ? "bg-coral-600 text-white"
                    : "bg-card text-ink-muted hover:bg-card-muted",
                )}
              >
                {p}×
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={onOpenVoices}>
              {voiceLabel ?? "Voice"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onSleepTimer}>
              Sleep timer
            </Button>
            <Button variant="ghost" size="sm" onClick={onSkipFillers}>
              Skip fillers
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mx-auto mb-2 max-w-reading px-4 text-sm text-danger"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function displayTimeFmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRemaining(seconds: number): string {
  const total = Math.floor(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

// Re-export for tests that need the helper.
export const __scrubberHelpers = { displayTimeFmt };
export const __QUICK_TAP_SPEEDS = QUICK_TAP_SPEEDS;