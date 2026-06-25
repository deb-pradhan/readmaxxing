"use client";

/**
 * Player — the live, state-aware player for the web app.
 *
 * Wraps the markup-only `packages/ui/primitives/Player` primitive with:
 *   - an internal `<audio>` element that consumes the cached blob URL,
 *   - `requestAnimationFrame` loop that syncs `audio.currentTime` to the
 *     speech-mark array and emits `onWordChange(wordIndex)` callbacks,
 *   - keyboard handlers per UI-UX.md §4.7,
 *   - speed control (0.5×–4.5×) preserving pitch,
 *   - resume-to-exact-word on mount (reads the cached position + the BFF),
 *   - resume position is debounced (500ms) and POSTed to `/api/positions`.
 *
 * The component is "smart" enough to be the only audio-aware consumer; all
 * it asks from the parent is the segment tree, the current voice id, and a
 * handful of callbacks.
 */

import * as React from "react";
import {
  Player as PlayerUI,
  KeyboardHelp,
  type PlayerStatus,
} from "@readmaxxing/ui";
import { SPEED_PRESETS } from "@readmaxxing/config";
import type { PlaybackPosition, SegmentTree, SpeechMark } from "@readmaxxing/core";
import { makePosition } from "@readmaxxing/core";
import { clientSynthesize } from "@/lib/tts/client";

export interface PlayerProps {
  tree: SegmentTree;
  /** Initial word offset to resume from (UI-UX.md §4.3). */
  initialWordOffset?: number;
  /** Voice to play with. */
  voiceId: string;
  /** Current speed. Defaults to 1×. */
  initialSpeed?: number;
  /** Server adapter for cross-device resume (SSE-backed in Phase 2). */
  userId: string;
  documentId: string;
  /** Fired on every word advance — drives the karaoke highlighter. */
  onWordChange: (wordIndex: number) => void;
  /** Fired when audio is ready — useful for analytics + speed presets. */
  onReady?: (info: { durationSeconds: number; marks: SpeechMark[] }) => void;
  /** Fired when the user seeks via the scrubber. */
  onSeek?: (timeSeconds: number) => void;
}

interface PlayerState {
  status: PlayerStatus;
  audioUrl: string | null;
  marks: SpeechMark[];
  duration: number;
  currentTime: number;
  currentWordIndex: number;
  speed: number;
  playing: boolean;
  loading: boolean;
  errorMessage: string | null;
}

const INITIAL: PlayerState = {
  status: "idle",
  audioUrl: null,
  marks: [],
  duration: 0,
  currentTime: 0,
  currentWordIndex: -1,
  speed: 1,
  playing: false,
  loading: false,
  errorMessage: null,
};

export function Player({
  tree,
  initialWordOffset = 0,
  voiceId,
  initialSpeed = 1,
  userId,
  documentId,
  onWordChange,
  onReady,
  onSeek,
}: PlayerProps) {
  const [state, setState] = React.useState<PlayerState>({ ...INITIAL, speed: initialSpeed });
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastWordIndexRef = React.useRef<number>(-1);
  const postTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [focusMode, setFocusMode] = React.useState(false);

  // ------------------------------------------------------------------
  // Synthesize on mount (or when voice / tree changes).
  // ------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", loading: true, errorMessage: null }));

    (async () => {
      try {
        const out = await clientSynthesize({
          text: tree.text,
          voiceId,
          speed: state.speed,
          documentId,
        });
        if (cancelled) {
          URL.revokeObjectURL(out.audioUrl);
          return;
        }
        setState((s) => ({
          ...s,
          status: "ready",
          loading: false,
          audioUrl: out.audioUrl,
          marks: out.marks,
          duration: 0, // updated on `loadedmetadata`
          currentTime: 0,
          currentWordIndex: -1,
          fromCache: out.fromCache,
        }));
        onReady?.({ durationSeconds: 0, marks: out.marks });
      } catch (err) {
        const e = err as { message?: string } | undefined;
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: "error",
          loading: false,
          errorMessage: e?.message ?? "Couldn't reach the voice service — try again.",
        }));
      }
    })();

    return () => {
      cancelled = true;
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    };
    // tree.text + voiceId are the only triggers — speed changes are
    // handled in the speed-effect below without re-synthesizing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.text, voiceId, documentId]);

  // ------------------------------------------------------------------
  // Resume to the initial word offset once audio is loaded.
  // ------------------------------------------------------------------
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state.status !== "ready" || initialWordOffset <= 0) return;
    // Find the word whose timeSeconds is closest to the offset's time.
    const mark = state.marks[initialWordOffset];
    if (mark) {
      audio.currentTime = mark.timeSeconds;
      setState((s) => ({ ...s, currentTime: mark.timeSeconds }));
      lastWordIndexRef.current = initialWordOffset;
      onWordChange(initialWordOffset);
    }
    // We intentionally depend on `status` and `initialWordOffset` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, initialWordOffset]);

  // ------------------------------------------------------------------
  // RAF loop — advances the word index based on `audio.currentTime`.
  // ------------------------------------------------------------------
  React.useEffect(() => {
    function tick() {
      const audio = audioRef.current;
      if (!audio) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = audio.currentTime;
      const idx = findWordAt(state.marks, t);
      if (idx !== lastWordIndexRef.current) {
        lastWordIndexRef.current = idx;
        onWordChange(idx);
      }
      setState((s) => ({ ...s, currentTime: t }));
      // Debounced position POST — 500ms.
      if (postTimerRef.current) clearTimeout(postTimerRef.current);
      postTimerRef.current = setTimeout(() => {
        const position: PlaybackPosition = makePosition({
          userId,
          documentId,
          wordOffset: idx,
          speed: state.speed,
        });
        void fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(position),
        }).catch(() => undefined);
      }, 500);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (postTimerRef.current) clearTimeout(postTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.marks, state.speed, userId, documentId]);

  // ------------------------------------------------------------------
  // Keyboard shortcuts (UI-UX.md §4.7).
  // ------------------------------------------------------------------
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const audio = audioRef.current;
      if (!audio) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          audio.currentTime = Math.max(0, audio.currentTime - (e.shiftKey ? 30 : 15));
          break;
        case "ArrowRight":
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.shiftKey ? 30 : 15));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed(Math.min(4.5, state.speed + 0.25));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed(Math.max(0.5, state.speed - 0.25));
          break;
        case "f":
        case "F":
          setFocusMode((v) => !v);
          break;
        case "?":
          setHelpOpen(true);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.speed]);

  // ------------------------------------------------------------------
  // Handlers.
  // ------------------------------------------------------------------

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setState((s) => ({ ...s, playing: true, status: "playing" }));
    } else {
      audio.pause();
      setState((s) => ({ ...s, playing: false, status: "paused" }));
    }
  }

  function setSpeed(next: number) {
    setState((s) => {
      if (audioRef.current) audioRef.current.playbackRate = next;
      return { ...s, speed: next };
    });
  }

  function handleSeek(timeSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(timeSeconds, audio.duration || 0));
    setState((s) => ({ ...s, currentTime: audio.currentTime }));
    onSeek?.(audio.currentTime);
  }

  const statusLabel = (() => {
    switch (state.status) {
      case "loading":
        return "Loading voice";
      case "playing":
        return "Playing";
      case "paused":
        return "Paused";
      case "ended":
        return "Ended";
      case "error":
        return state.errorMessage ?? "Error";
      default:
        return "Ready";
    }
  })();

  return (
    <>
      <audio
        ref={audioRef}
        src={state.audioUrl ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          audio.playbackRate = state.speed;
          setState((s) => ({ ...s, duration: audio.duration }));
          onReady?.({ durationSeconds: audio.duration, marks: state.marks });
        }}
        onPlay={() => setState((s) => ({ ...s, playing: true, status: "playing" }))}
        onPause={() => setState((s) => ({ ...s, playing: false, status: "paused" }))}
        onEnded={() => setState((s) => ({ ...s, playing: false, status: "ended" }))}
        onError={() =>
          setState((s) => ({
            ...s,
            status: "error",
            errorMessage: "Audio playback failed — try again.",
          }))
        }
      />
      <PlayerUI
        playing={state.playing}
        loading={state.loading}
        currentTime={state.currentTime}
        duration={state.duration}
        onSeek={handleSeek}
        speed={state.speed}
        onSpeedChange={setSpeed}
        speedPresets={[...SPEED_PRESETS]}
        voiceLabel={voiceId}
        errorMessage={state.errorMessage}
        statusLabel={statusLabel}
        onPlayPause={togglePlay}
        onShowHelp={() => setHelpOpen(true)}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      {/* `focusMode` is propagated by parent — exported via attribute. */}
      <span data-focus-mode={focusMode ? "true" : "false"} className="hidden" />
    </>
  );
}

// =============================================================================
// Helpers
// =============================================================================

/** Binary search for the word whose timeSeconds ≤ t (mirrors the TS spec). */
function findWordAt(marks: ReadonlyArray<SpeechMark>, t: number): number {
  if (marks.length === 0) return -1;
  let lo = 0;
  let hi = marks.length - 1;
  let lastWord = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = marks[mid]!;
    if (m.type !== "word") {
      if (m.timeSeconds <= t) lo = mid + 1;
      else hi = mid - 1;
      continue;
    }
    if (m.timeSeconds <= t) {
      // Word index = number of `word` marks up to and including this one minus 1.
      lastWord = countWordMarksUpTo(marks, mid);
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return lastWord;
}

function countWordMarksUpTo(marks: ReadonlyArray<SpeechMark>, upTo: number): number {
  let count = 0;
  for (let i = 0; i <= upTo; i++) if (marks[i]!.type === "word") count++;
  return count - 1;
}