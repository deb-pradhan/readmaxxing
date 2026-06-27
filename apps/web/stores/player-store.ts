/**
 * Player store — Zustand state for the live web-player.
 *
 * Centralizes the state shape that the player + reader surfaces both read.
 * Splitting state from the PlayerBar component lets the reader surface
 * subscribe to the same store and avoid prop drilling.
 *
 * Actions map 1:1 to UI-UX.md §4 rules:
 *   - play / pause           (§4.2)
 *   - seek / setRate         (§4.5/§4.6)
 *   - nextSentence / prev    (§4.7)
 *   - seekToWord             (§5 click-to-jump)
 *   - toggleFocusMode        (§5)
 *   - setVoiceId             (§4.2 voice menu)
 */

import { create } from "zustand";
import { DEFAULT_ELEVENLABS_VOICE_ID } from "@readmaxxing/tts";

export interface PlayerState {
  /** Whether the player is actively playing. */
  playing: boolean;
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total duration in seconds (0 = not yet known). */
  duration: number;
  /** Current playback rate. */
  speed: number;
  /** Active voice id. */
  voiceId: string;
  /** Active focus-mode flag. */
  focusMode: boolean;
  /** Active bionic-reading flag. */
  bionicReading: boolean;
  /** Active word index (-1 if none). */
  currentWordIndex: number;
  /** Active sentence index (-1 if none). */
  currentSentenceIndex: number;
  /** Loading flag (synthesizing first audio chunk). */
  loading: boolean;
  /** Error message (human + actionable). */
  errorMessage: string | null;
  /** Phase: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'. */
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";
  /** Skip-filler toggle. UI-UX.md §4.9 — when true, the player jumps over
   *  skippable sentences detected by `detect_fillers`. */
  skipFillerEnabled: boolean;
  /** Skipped-sentence count for telemetry (TESTING.md §9). */
  skippedFillerCount: number;
}

export interface PlayerActions {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(timeSeconds: number): void;
  setSpeed(next: number): void;
  setVoiceId(voiceId: string): void;
  setFocusMode(value: boolean): void;
  toggleFocusMode(): void;
  setBionicReading(value: boolean): void;
  toggleBionic(): void;
  setWord(index: number): void;
  setSentence(index: number): void;
  setCurrentTime(time: number): void;
  setDuration(duration: number): void;
  setStatus(status: PlayerState["status"]): void;
  setLoading(loading: boolean): void;
  setError(message: string | null): void;
  /** Move to the previous or next sentence based on the segment tree + indices. */
  nextSentence(): void;
  prevSentence(): void;
  /** Jump to a specific word offset (UI-UX.md §5 click-to-jump). */
  seekToWord(wordIndex: number): void;
  /** Toggle the skip-filler feature (UI-UX.md §4.9). */
  setSkipFillerEnabled(value: boolean): void;
  toggleSkipFiller(): void;
  /** Increment the skip counter (telemetry). */
  recordFillerSkip(count?: number): void;
  reset(): void;
}

export type PlayerStore = PlayerState & PlayerActions;

const DEFAULT_STATE: PlayerState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  speed: 1,
  voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
  focusMode: false,
  bionicReading: false,
  currentWordIndex: -1,
  currentSentenceIndex: -1,
  loading: false,
  errorMessage: null,
  status: "idle",
  skipFillerEnabled: false,
  skippedFillerCount: 0,
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...DEFAULT_STATE,

  play: () => set({ playing: true, status: "playing", errorMessage: null }),
  pause: () => set({ playing: false, status: "paused" }),
  toggle: () => {
    const next = !get().playing;
    set({ playing: next, status: next ? "playing" : "paused" });
  },
  seek: (timeSeconds) =>
    set((s) => ({
      currentTime: Math.max(0, Math.min(timeSeconds, s.duration || timeSeconds)),
    })),
  setSpeed: (next) =>
    set({
      speed: Math.max(0.5, Math.min(next, 4.5)),
    }),
  setVoiceId: (voiceId) => set({ voiceId }),
  setFocusMode: (value) => set({ focusMode: value }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setBionicReading: (value) => set({ bionicReading: value }),
  toggleBionic: () => set((s) => ({ bionicReading: !s.bionicReading })),
  setWord: (index) => set({ currentWordIndex: index }),
  setSentence: (index) => set({ currentSentenceIndex: index }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
  setError: (message) => set({ errorMessage: message, status: message ? "error" : get().status }),

  nextSentence: () => {
    // Pure state-store action — the consumer wires this to the segment tree.
    set((s) => ({
      currentSentenceIndex: Math.max(0, s.currentSentenceIndex + 1),
    }));
  },
  prevSentence: () => {
    set((s) => ({
      currentSentenceIndex: Math.max(0, s.currentSentenceIndex - 1),
    }));
  },
  seekToWord: (wordIndex) => set({ currentWordIndex: Math.max(0, wordIndex) }),
  setSkipFillerEnabled: (value) => set({ skipFillerEnabled: value }),
  toggleSkipFiller: () => set((s) => ({ skipFillerEnabled: !s.skipFillerEnabled })),
  recordFillerSkip: (count = 1) =>
    set((s) => ({ skippedFillerCount: s.skippedFillerCount + count })),
  reset: () => set({ ...DEFAULT_STATE }),
}));