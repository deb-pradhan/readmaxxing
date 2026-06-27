"use client";

/**
 * VoicePicker — grid of voices with one-tap preview on a shared
 * sample.
 *
 * Per DESIGN-SYSTEM §11.3 + §11.7 + §13:
 * - The picker shows marquee defaults + the user's cloned voices.
 *   Cloned voices sort to the top with a "Your voice" badge.
 * - Each tile is a slightly rounded square (10px) on the card
 *   surface; selected voices get the coral ring + accent border.
 */

import * as React from "react";
import { cn } from "../cn";

export interface VoicePickerVoice {
  id: string;
  name: string;
  label?: string;
  isMarquee?: boolean;
  /** True for voices trained by the current user. */
  isCloned?: boolean;
}

export interface VoicePickerProps {
  voices: VoicePickerVoice[];
  /** Currently-selected voice id. */
  value: string | null;
  onChange: (id: string) => void;
  /** Optional async preview — returns a playable audio URL. */
  onPreview?: (voiceId: string) => Promise<string | null>;
  /** Fixed sample used by the default preview flow. */
  sampleText?: string;
  className?: string;
}

const DEFAULT_SAMPLE = "The calm interface gets out of your way and lets the words lead.";

export function VoicePicker({
  voices,
  value,
  onChange,
  onPreview,
  sampleText = DEFAULT_SAMPLE,
  className,
}: VoicePickerProps): React.JSX.Element {
  const [previewing, setPreviewing] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePreview = async (voiceId: string): Promise<void> => {
    if (!onPreview) return;
    setPreviewing(voiceId);
    try {
      const url = await onPreview(voiceId);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      if (url) {
        const audio = new Audio(url);
        audio.onended = () => setPreviewing(null);
        await audio.play().catch(() => setPreviewing(null));
      } else {
        setPreviewing(null);
      }
    } catch {
      setPreviewing(null);
    }
  };

  // Sort cloned voices to the top — DESIGN-SYSTEM §13: "Cloned voices
  // appear at the top of the user's voice list with a 'Your voice'
  // badge."
  const sortedVoices = React.useMemo(
    () => [...voices].sort((a, b) => Number(Boolean(b.isCloned)) - Number(Boolean(a.isCloned))),
    [voices],
  );

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {sortedVoices.map((voice) => {
        const selected = voice.id === value;
        const playing = previewing === voice.id;
        return (
          <div
            key={voice.id}
            className={cn(
              "relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-all",
              selected
                ? "border-coral-bg ring-2 ring-coral-soft"
                : "border-border hover:border-border-strong",
            )}
          >
            <button
              type="button"
              onClick={() => onChange(voice.id)}
              aria-pressed={selected}
              className="flex flex-1 flex-col items-start gap-1 text-left focus-visible:shadow-focus"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-md font-semibold">{voice.name}</span>
                {voice.isCloned ? (
                  <span
                    data-testid="your-voice-badge"
                    className="rounded-full bg-coral-soft px-2 py-0.5 text-xs font-medium text-coral-text"
                  >
                    Your voice
                  </span>
                ) : voice.isMarquee ? (
                  <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs font-medium text-coral-text">
                    Recommended
                  </span>
                ) : null}
              </div>
              {voice.label ? (
                <span className="text-xs text-ink-muted">{voice.label}</span>
              ) : null}
              <span className="mt-1 text-xs text-ink-faint">"{sampleText.slice(0, 40)}…"</span>
            </button>
            <button
              type="button"
              onClick={() => handlePreview(voice.id)}
              disabled={!onPreview || playing}
              aria-label={`Preview ${voice.name}`}
              className={cn(
                "inline-flex h-9 items-center gap-1 self-start rounded-md border border-border px-2 text-xs",
                "text-ink-muted hover:bg-card-muted focus-visible:shadow-focus",
                (!onPreview || playing) && "opacity-50",
              )}
            >
              {playing ? <span className="tabular">▮▮</span> : <span aria-hidden>▶</span>}
              <span>{playing ? "Playing" : "Preview"}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}