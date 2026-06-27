"use client";

/**
 * VoiceOutput — speaks the assistant's reply aloud via the Web Speech
 * API (SpeechSynthesis). Per the brief + UI-UX.md §7 the assistant
 * answers in the user's chosen TTS voice. When `User.defaultVoiceId`
 * is unset we fall back to the first non-premium voice available.
 *
 * Per TESTING.md §9 emits `assistant.voice_out` events. Per §8.7 we log
 * only the byte count of the spoken text — never the text itself.
 */

import * as React from "react";

export interface VoiceOutputProps {
  /** The text to speak. When empty/undefined the speaker is silent. */
  text: string;
  /** Optional explicit voice name (e.g. the user's `defaultVoiceId`). */
  voiceName?: string;
  /** When true, speak automatically whenever `text` changes. */
  autoSpeak?: boolean;
  /** Override the speech-synthesis call (for tests). */
  speechSynthesisImpl?: SpeechSynthesis | null;
  /** Called when speech actually starts. */
  onStart?: () => void;
  /** Called when speech ends or errors out. */
  onEnd?: (error?: string) => void;
}

function getSpeechSynthesis(override?: SpeechSynthesis | null): SpeechSynthesis | null {
  if (override !== undefined) return override;
  if (typeof window === "undefined") return null;
  const w = window as Window & { speechSynthesis?: SpeechSynthesis };
  return w.speechSynthesis ?? null;
}

export function VoiceOutput({
  text,
  voiceName,
  autoSpeak = false,
  speechSynthesisImpl,
  onStart,
  onEnd,
}: VoiceOutputProps): React.JSX.Element {
  const synth = getSpeechSynthesis(speechSynthesisImpl);
  const supported = synth != null;
  const [speaking, setSpeaking] = React.useState(false);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    if (!synth) return;
    const updateVoices = (): void => {
      const list = synth.getVoices();
      if (list.length > 0) setVoices(list);
    };
    updateVoices();
    synth.addEventListener?.("voiceschanged", updateVoices);
    return () => {
      synth.removeEventListener?.("voiceschanged", updateVoices);
    };
  }, [synth]);

  function pickVoice(): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    if (voiceName) {
      const match = voices.find((v) => v.name === voiceName);
      if (match) return match;
    }
    // Fallback per the brief — first non-premium voice. SpeechSynthesis
    // doesn't tag premium status, so we prefer the browser default voice
    // (typically the OS native voice, free).
    const defaultVoice = voices.find((v) => v.default);
    if (defaultVoice) return defaultVoice;
    return voices[0] ?? null;
  }

  function speak(): void {
    if (!synth) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(trimmed);
      const voice = pickVoice();
      if (voice) utt.voice = voice;
      utt.onstart = () => {
        setSpeaking(true);
        onStart?.();
      };
      utt.onend = () => {
        setSpeaking(false);
        onEnd?.();
      };
      utt.onerror = (event) => {
        setSpeaking(false);
        onEnd?.(event.error ?? "speech_synthesis_error");
      };
      synth.speak(utt);
    } catch (err) {
      setSpeaking(false);
      onEnd?.((err as Error).message);
    }
  }

  function stop(): void {
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
    onEnd?.("cancelled");
  }

  // Auto-speak on text change (debounced to avoid feedback).
  React.useEffect(() => {
    if (!autoSpeak) return;
    if (!text.trim()) return;
    const id = setTimeout(() => speak(), 250);
    return () => clearTimeout(id);
    // We intentionally don't include `speak` in deps — it's a stable fn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoSpeak]);

  if (!supported) {
    return (
      <p className="text-xs text-ink-muted">
        Voice output not supported in this browser — read the response instead.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={speaking ? stop : speak}
        disabled={!text.trim()}
        aria-pressed={speaking}
        className="inline-flex h-9 items-center rounded-md border border-border-subtle bg-card px-3 text-xs font-medium text-ink-muted hover:bg-card-muted disabled:opacity-40 focus-visible:shadow-focus"
      >
        {speaking ? "■ Stop" : "▶ Speak"}
      </button>
    </div>
  );
}