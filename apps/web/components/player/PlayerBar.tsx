"use client";

/**
 * PlayerBar — persistent bottom bar.
 *
 * Per DESIGN-SYSTEM §4.2 the bar exposes Play/Pause + scrubber + time
 * by default. Everything else lives behind a menu. The tap target
 * for the primary action is ≥ 56px (DESIGN-SYSTEM §11.1).
 *
 * Now uses the new tokens: coral for the play button, 12px radii on
 * the chip rows, 48px button height, tabular numbers everywhere.
 */

import * as React from "react";
import { SPEED_PRESETS, QUICK_TAP_SPEEDS } from "@readmaxxing/config";
import { Button, DropdownMenu, cn } from "@readmaxxing/ui";
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
  className,
}: PlayerBarProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const [scrubbing, setScrubbing] = React.useState(false);
  const [scrubValue, setScrubValue] = React.useState(0);

  const safeDuration = Math.max(0, duration);
  const safeCurrent = Math.max(0, Math.min(currentTime, safeDuration || currentTime));
  const displayTime = scrubbing ? scrubValue : safeCurrent;
  const percent = safeDuration > 0 ? Math.min(100, Math.max(0, (safeCurrent / safeDuration) * 100)) : 0;

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

  return (
    <section
      role="region"
      aria-label="Player"
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
        className="block w-full px-4 pt-2 text-left text-xs text-ink-muted focus-visible:outline-none focus-visible:shadow-focus"
      >
        <span className="tabular text-ink">{displayTimeFmt(displayTime)}</span>
        <span className="px-2 text-ink-faint">/</span>
        <span className="tabular">{displayTimeFmt(safeDuration)}</span>
        <span className="px-2 text-ink-faint">·</span>
        <span className="text-sm text-ink">{title}</span>
        <span className="ml-2">{expanded ? "▾" : "▴"}</span>
      </button>

      <div className="mx-auto flex max-w-reading items-center gap-4 px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => nudge(-SEEK_BIG_SECONDS)}
          aria-label="Back 30 seconds (Shift+Left)"
          className="tabular hidden h-12 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          ⟨30
        </button>
        <button
          type="button"
          onClick={() => nudge(-SEEK_STEP_SECONDS)}
          aria-label="Back 15 seconds (Left)"
          className="tabular hidden h-12 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          ⟨15
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playPauseLabel ?? (playing ? "Pause" : "Play")}
          className={cn(
            "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md",
            "bg-coral-bg text-white transition-transform duration-fast ease-out",
            "hover:scale-[1.03] active:scale-[0.97] focus-visible:shadow-focus",
          )}
        >
          {loading ? (
            <span
              aria-hidden
              className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent"
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
          className="tabular hidden h-12 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          15⟩
        </button>
        <button
          type="button"
          onClick={() => nudge(SEEK_BIG_SECONDS)}
          aria-label="Forward 30 seconds (Shift+Right)"
          className="tabular hidden h-12 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-ink-muted hover:bg-card-muted focus-visible:shadow-focus sm:inline-flex"
        >
          30⟩
        </button>

        <Scrubber
          time={displayTime}
          duration={safeDuration}
          percent={percent}
          onScrubStart={() => setScrubbing(true)}
          onScrubChange={setScrubValue}
          onScrubEnd={(value) => {
            setScrubbing(false);
            onSeek(value);
          }}
        />

        <span
          aria-hidden
          className="tabular hidden text-sm text-ink-muted md:inline"
        >
          {displayTimeFmt(displayTime)} / {displayTimeFmt(safeDuration)}
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
            <span className="tabular text-xs uppercase tracking-widest text-ink-muted">
              {speed.toFixed(2)}×
            </span>
            {voiceLabel ? (
              <span className="tabular text-xs">· {voiceLabel}</span>
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
                  "tabular rounded-md border border-border-subtle px-2 py-1 text-xs",
                  Math.abs(speed - p) < 0.01
                    ? "bg-coral-bg text-white"
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

export interface ScrubberProps {
  time: number;
  duration: number;
  percent: number;
  onScrubStart: () => void;
  onScrubChange: (value: number) => void;
  onScrubEnd: (value: number) => void;
}

function Scrubber({
  time,
  duration,
  percent,
  onScrubStart,
  onScrubChange,
  onScrubEnd,
}: ScrubberProps): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        onPointerDown={onScrubStart}
        onChange={(e) => onScrubChange(Number(e.currentTarget.value))}
        onPointerUp={(e) => onScrubEnd(Number(e.currentTarget.value))}
        onKeyUp={(e) => onScrubEnd(Number((e.target as HTMLInputElement).value))}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={time}
        aria-valuetext={`${displayTimeFmt(time)} / ${displayTimeFmt(duration)}`}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border-subtle accent-coral-bg focus-visible:outline-none focus-visible:shadow-focus"
      />
      <span aria-hidden className="tabular w-9 text-right text-xs text-ink-muted">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function displayTimeFmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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