"use client";

/**
 * VoicePicker — grid of voices with one-tap preview on a shared sample.
 *
 * UI-UX.md §6: the picker previews each voice on the user's text when
 * available. In Phase 1 we ship a fixed sample sentence ("The calm
 * interface gets out of your way and lets the words lead.") so the user
 * can audition voices without committing. Real `audition on your text`
 * lands in Phase 2 once the ElevenLabs streaming pipeline is in place.
 */

import * as React from "react";
import { cn } from "../cn";

export interface VoicePickerVoice {
  id: string;
  name: string;
  label?: string;
  isMarquee?: boolean;
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
}: VoicePickerProps) {
  const [previewing, setPreviewing] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePreview = async (voiceId: string) => {
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

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {voices.map((voice) => {
        const selected = voice.id === value;
        const playing = previewing === voice.id;
        return (
          <div
            key={voice.id}
            className={cn(
              "relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-all",
              selected
                ? "border-accent ring-2 ring-accent-soft"
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
                <span className="font-serif text-md font-semibold">{voice.name}</span>
                {voice.isMarquee ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    Recommended
                  </span>
                ) : null}
              </div>
              {voice.label ? (
                <span className="text-xs text-ink-muted">{voice.label}</span>
              ) : null}
              <span className="mt-1 text-xs text-ink-faint">“{sampleText.slice(0, 40)}…”</span>
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