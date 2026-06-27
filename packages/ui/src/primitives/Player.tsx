"use client";

/**
 * Player — markup-only player shell. Implements DESIGN-SYSTEM §11
 * (Buttons / chips), §4 (motion), §13 (dashboard card patterns).
 *
 * State and audio playback live in the *consumer* (apps/web's
 * `components/player/Player.tsx`), which feeds this primitive via
 * props. The primitive renders the controls + scrubber + speed menu
 * and surfaces callbacks for every interaction.
 */

import * as React from "react";
import { cn } from "../cn";

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export interface PlayerProps {
  /** Play / pause state. */
  playing: boolean;
  onPlayPause: () => void;
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total duration in seconds. */
  duration: number;
  onSeek: (timeSeconds: number) => void;
  /** Current speed multiplier (0.5 – 4.5). */
  speed: number;
  onSpeedChange: (next: number) => void;
  /** Available speed presets to surface as quick-tap buttons. */
  speedPresets?: number[];
  /** Voice picker trigger. */
  onOpenVoices?: () => void;
  /** Current voice label, if any. */
  voiceLabel?: string;
  /** Show the keyboard help sheet. */
  onShowHelp?: () => void;
  /** Show the speed menu. */
  onShowSpeedMenu?: () => void;
  /** Loading indicator when audio is buffering. */
  loading?: boolean;
  /** Error message — DESIGN-SYSTEM §17.3: human + actionable. */
  errorMessage?: string | null;
  /** Status string for screen readers. */
  statusLabel?: string;
  className?: string;
}

export const Player = React.forwardRef<HTMLDivElement, PlayerProps>(function Player(
  {
    playing,
    onPlayPause,
    currentTime,
    duration,
    onSeek,
    speed,
    onSpeedChange,
    speedPresets = [1, 1.25, 1.5, 2, 3],
    onOpenVoices,
    voiceLabel,
    onShowHelp,
    onShowSpeedMenu,
    loading = false,
    errorMessage = null,
    statusLabel,
    className,
  },
  ref,
) {
  const [scrubbing, setScrubbing] = React.useState(false);
  const [scrubValue, setScrubValue] = React.useState(0);
  const effectiveTime = scrubbing ? scrubValue : currentTime;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Player"
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky border-t border-border-subtle bg-card/95 backdrop-blur-md",
        "px-4 py-3 shadow-lg",
        className,
      )}
    >
      <div className="mx-auto flex max-w-reading items-center gap-4">
        <PlayPauseButton
          playing={playing}
          loading={loading}
          onClick={onPlayPause}
          aria-label={playing ? "Pause" : "Play"}
        />

        <Scrubber
          time={effectiveTime}
          duration={duration}
          onScrubStart={() => setScrubbing(true)}
          onScrubChange={setScrubValue}
          onScrubEnd={(value) => {
            setScrubbing(false);
            onSeek(value);
          }}
        />

        <TimeReadout current={currentTime} total={duration} />

        <SpeedMenu
          speed={speed}
          presets={speedPresets}
          onChange={onSpeedChange}
          onOpenCustom={onShowSpeedMenu}
        />

        {onOpenVoices ? (
          <button
            type="button"
            onClick={onOpenVoices}
            className="hidden h-12 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
            aria-label="Change voice"
          >
            <span aria-hidden>♪</span>
            <span className="max-w-[8rem] truncate">{voiceLabel ?? "Voice"}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onShowHelp}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <span aria-hidden className="text-lg font-semibold">?</span>
        </button>
      </div>

      {errorMessage ? (
        <p role="alert" className="mx-auto mt-2 max-w-reading text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <span className="rmx-live">{statusLabel}</span>
    </div>
  );
});

// =============================================================================
// Sub-components (also exported individually below).
// =============================================================================

export interface PlayPauseButtonProps {
  playing: boolean;
  loading: boolean;
  onClick: () => void;
  "aria-label"?: string;
}

export function PlayPauseButton({ playing, loading, onClick, ...rest }: PlayPauseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rest["aria-label"] ?? (playing ? "Pause" : "Play")}
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
  );
}

export interface ScrubberProps {
  time: number;
  duration: number;
  onScrubStart: () => void;
  onScrubChange: (value: number) => void;
  onScrubEnd: (value: number) => void;
}

export function Scrubber({ time, duration, onScrubStart, onScrubChange, onScrubEnd }: ScrubberProps) {
  const safe = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
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
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border-subtle accent-coral-bg focus-visible:outline-none focus-visible:shadow-focus"
      />
      <span className="tabular w-9 text-right text-xs text-ink-muted">{Math.round(safe * 100)}%</span>
    </div>
  );
}

export function TimeReadout({ current, total }: { current: number; total: number }) {
  return (
    <span className="tabular hidden text-sm text-ink-muted md:inline" aria-hidden>
      {fmt(current)} / {fmt(total)}
    </span>
  );
}

export interface SpeedMenuProps {
  speed: number;
  presets: number[];
  onChange: (next: number) => void;
  onOpenCustom?: () => void;
}

export function SpeedMenu({ speed, presets, onChange, onOpenCustom }: SpeedMenuProps) {
  return (
    <div className="hidden items-center gap-1 rounded-md border border-border-subtle p-1 md:inline-flex">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={speed === p}
          className={cn(
            "tabular min-w-[3rem] rounded-sm px-2 py-1 text-xs font-medium transition-colors",
            speed === p ? "bg-coral-bg text-white" : "text-ink-muted hover:bg-card-muted",
          )}
        >
          {p}×
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenCustom}
        aria-label="Custom speed"
        className="ml-1 rounded-sm p-1 text-ink-muted hover:bg-card-muted focus-visible:shadow-focus"
      >
        <span aria-hidden>⋯</span>
      </button>
    </div>
  );
}

export interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-modal flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-subtle bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="tabular font-mono text-ink-muted">{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-12 w-full rounded-md bg-coral-bg text-white focus-visible:shadow-focus"
        >
          Close
        </button>
      </div>
    </div>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["Space", "Play / pause"],
  ["←  /  →", "Seek ±15s"],
  ["Shift + ←/→", "Seek ±30s"],
  ["↑  /  ↓", "Speed ±0.25×"],
  ["J  /  K", "Previous / next sentence"],
  ["R", "Repeat sentence"],
  ["F", "Focus mode"],
  ["/", "Search"],
  ["?", "This help"],
];

// =============================================================================
// Icons — inline SVGs keep the bundle small (no icon-pack dep).
// =============================================================================

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}