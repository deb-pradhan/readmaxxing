"use client";

/**
 * /voice — the user's voice picker + voice cloning wizard.
 *
 * Per DESIGN-SYSTEM §13.4 + §11.7:
 *   - Cloned voices sort to the top with a "Your voice" badge.
 *   - Marquee voices get the "Recommended" badge.
 *   - Voice cloning is a non-mid-flow wizard — never interrupts
 *     playback.
 */

import * as React from "react";
import { Button, VoicePicker } from "@readmaxxing/ui";
import { VoiceCloneFlow } from "@/components/voice/VoiceCloneFlow";
import { AppHeader } from "@/components/shared/AppHeader";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

interface VoiceRow {
  id: string;
  name: string;
  isMarquee: boolean;
  isCloned: boolean;
  label?: string;
}

const SAMPLE_VOICES: VoiceRow[] = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", isMarquee: true, isCloned: false, label: "British, clear" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", isMarquee: false, isCloned: false, label: "Warm storyteller" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", isMarquee: false, isCloned: false, label: "Bright, energetic" },
  { id: "cloned:example-1", name: "My voice (Calm)", isMarquee: false, isCloned: true },
];

export default function VoicePage(): React.JSX.Element {
  const [voices, setVoices] = React.useState<VoiceRow[]>(SAMPLE_VOICES);
  const [selected, setSelected] = React.useState<string | null>(SAMPLE_VOICES[0]?.id ?? null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  function onCloned(voiceId: string): void {
    setVoices((prev) => {
      if (prev.some((v) => v.id === voiceId)) return prev;
      return [
        ...prev,
        { id: voiceId, name: "My voice", isMarquee: false, isCloned: true },
      ];
    });
    setSelected(voiceId);
    setWizardOpen(false);
  }

  return (
    <div className="min-h-dvh">
      <AppHeader section="Voices">
        <ThemeSwitcher />
      </AppHeader>

      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Voices</h1>
          <p className="mt-2 text-base text-ink-muted">
            Pick a voice for every listen — or clone your own. Cloned voices are private to you.
          </p>
        </div>

        <section aria-label="Voice picker" className="mt-8">
          <div className="rounded-lg border border-border-subtle bg-card p-5">
            <VoicePicker
              voices={voices}
              value={selected}
              onChange={setSelected}
              onPreview={async (id) => {
                if (id.startsWith("cloned:")) return `/api/voice/preview/${id}`;
                return null;
              }}
            />
          </div>
        </section>

        <section aria-label="Clone your voice" className="mt-10">
          <div className="rounded-lg border border-border-subtle bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">Want your own voice?</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Record a short sample and we&apos;ll create a private clone just for you.
                </p>
              </div>
              <Button
                type="button"
                variant={wizardOpen ? "secondary" : "primary"}
                size="md"
                onClick={() => setWizardOpen((o) => !o)}
                className="shrink-0"
              >
                {wizardOpen ? "Close" : "Clone a voice"}
              </Button>
            </div>
            {wizardOpen ? (
              <div className="mt-5 border-t border-border-subtle pt-5">
                <VoiceCloneFlow onCloned={onCloned} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
