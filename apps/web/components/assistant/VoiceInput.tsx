"use client";

/**
 * VoiceInput — Web Speech API wrapper for the assistant (UI-UX.md §7).
 *
 * Per the brief + TESTING.md §2.10:
 *   - Uses the browser's `SpeechRecognition` API when available.
 *   - Graceful fallback: a textarea "Voice input not supported in this
 *     browser — type instead." when SpeechRecognition is missing
 *     (Firefox desktop per UI-UX.md §6).
 *   - Honest state: `idle | listening | stopped | error`.
 *   - Interim transcripts appear in real time; final transcript replaces
 *     them without flicker.
 *   - Per TESTING.md §9 emits `assistant.voice_in` events (count + bytes
 *     only — never raw text).
 *
 * The Web Speech API types aren't part of TS's lib.dom.d.ts, so we
 * declare a local `SpeechRecognitionCtor` interface to keep types tight
 * across the file. Tests pass `speechRecognitionImpl` to inject a mock.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

export interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

export interface VoiceInputProps {
  /** Called when the final transcript is captured. */
  onTranscript: (text: string) => void;
  className?: string;
  /** Optional override for the Web Speech API (tests). */
  speechRecognitionImpl?: SpeechRecognitionCtor | null;
  /** Hook for tests + observability — receives the lifecycle event names. */
  onStateChange?: (
    state: VoiceInputState,
    info?: { durationMs?: number; bytes?: number },
  ) => void;
}

export type VoiceInputState =
  | "idle"
  | "listening"
  | "stopped"
  | "error"
  | "unsupported";

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getSpeechRecognitionCtor(
  override?: SpeechRecognitionCtor | null,
): SpeechRecognitionCtor | null {
  if (override !== undefined) return override;
  if (typeof window === "undefined") return null;
  const w = window as WindowWithSpeechRecognition;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  onTranscript,
  className,
  speechRecognitionImpl,
  onStateChange,
}: VoiceInputProps): React.JSX.Element {
  const ctor = getSpeechRecognitionCtor(speechRecognitionImpl);
  const supported = ctor != null;

  const [state, setState] = React.useState<VoiceInputState>(
    supported ? "idle" : "unsupported",
  );
  const [interim, setInterim] = React.useState("");
  const [final, setFinal] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fallbackText, setFallbackText] = React.useState("");
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = React.useRef<number | null>(null);

  const onTranscriptRef = React.useRef(onTranscript);
  React.useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const onStateChangeRef = React.useRef(onStateChange);
  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  function setStateAndEmit(
    next: VoiceInputState,
    info?: { durationMs?: number; bytes?: number },
  ): void {
    setState(next);
    onStateChangeRef.current?.(next, info);
  }

  function start(): void {
    if (!ctor) return;
    setErrorMessage(null);
    setInterim("");
    setFinal("");
    try {
      const r = new ctor();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.onresult = (event: SpeechRecognitionResultEventLike) => {
        let interimText = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]!;
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
        if (interimText) setInterim(interimText);
        if (finalText) {
          setFinal((prev) => prev + finalText);
          setInterim("");
          const text = (finalText || interimText).trim();
          if (text) {
            const bytes = new TextEncoder().encode(text).length;
            onTranscriptRef.current(text);
            onStateChangeRef.current?.("stopped", {
              durationMs: startedAtRef.current
                ? Date.now() - startedAtRef.current
                : undefined,
              bytes,
            });
          }
        }
      };
      r.onerror = (event) => {
        const message = event.error ?? event.message ?? "speech_recognition_error";
        setErrorMessage(message);
        setStateAndEmit("error");
      };
      r.onend = () => {
        if (startedAtRef.current != null) {
          startedAtRef.current = null;
          setStateAndEmit("stopped");
        }
      };
      recognitionRef.current = r;
      r.start();
      startedAtRef.current = Date.now();
      setStateAndEmit("listening");
    } catch (err) {
      setErrorMessage((err as Error).message);
      setStateAndEmit("error");
    }
  }

  function stop(): void {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      /* ignore */
    }
    startedAtRef.current = null;
    setStateAndEmit("stopped");
  }

  function submitFallback(): void {
    const text = fallbackText.trim();
    if (!text) return;
    setFallbackText("");
    onTranscript(text);
  }

  if (!supported) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs text-ink-muted">
          Voice input not supported in this browser — type instead.
        </p>
        <div className="flex gap-2">
          <label htmlFor="voice-input-fallback" className="sr-only">
            Type your message
          </label>
          <input
            id="voice-input-fallback"
            type="text"
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitFallback();
              }
            }}
            placeholder="Type instead…"
            className="h-10 flex-1 rounded-md border border-border-subtle bg-canvas px-3 text-sm focus-visible:shadow-focus"
          />
          <button
            type="button"
            onClick={submitFallback}
            disabled={!fallbackText.trim()}
            className="inline-flex h-10 items-center rounded-md bg-accent px-3 text-sm font-medium text-white disabled:opacity-40 focus-visible:shadow-focus"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={state === "listening" ? stop : start}
        aria-pressed={state === "listening"}
        aria-label={state === "listening" ? "Stop listening" : "Start listening"}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform duration-fast ease-out hover:scale-[1.03] active:scale-[0.97] focus-visible:shadow-focus",
          state === "listening" ? "bg-danger" : "bg-accent",
        )}
      >
        <MicIcon listening={state === "listening"} />
      </button>
      <div
        aria-live="polite"
        className="tabular flex-1 truncate text-sm text-ink-muted"
      >
        {state === "listening" ? (
          interim ? (
            <span>
              Listening: <em className="text-ink">{interim}</em>
            </span>
          ) : (
            "Listening…"
          )
        ) : state === "stopped" && final ? (
          <span>Last: {final}</span>
        ) : state === "error" ? (
          <span className="text-danger">
            {errorMessage ?? "Couldn't hear you — try again."}
          </span>
        ) : (
          "Tap the mic to talk."
        )}
      </div>
    </div>
  );
}

function MicIcon({ listening }: { listening: boolean }): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
      {listening ? (
        <circle
          cx="12"
          cy="12"
          r="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        />
      ) : null}
    </svg>
  );
}