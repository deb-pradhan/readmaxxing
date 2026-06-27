/**
 * PopupSettings — voice + speed defaults.
 *
 * Reuses the shared `VoicePicker` primitive from `@readmaxxing/ui`
 * (UI-UX.md §11 consistency). The settings write through to the BFF
 * `/api/user/preferences` PUT route so the change is mirrored across
 * devices on the next SSE poll (mobile, web).
 */

import * as React from "react";
import { VoicePicker, type VoicePickerVoice } from "@readmaxxing/ui";
import { bffFetch } from "@/lib/auth";

interface PreferencesResponse {
  defaultVoiceId: string;
  defaultSpeed: number;
  bionic: boolean;
  theme: string;
}

export interface PopupSettingsProps {
  initialTab?: "general" | "voices";
}

export function PopupSettings({ initialTab = "general" }: PopupSettingsProps): React.JSX.Element {
  const [voices, setVoices] = React.useState<VoicePickerVoice[]>([]);
  const [prefs, setPrefs] = React.useState<PreferencesResponse | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [voicesRes, prefsRes] = await Promise.all([
          bffFetch("/api/voices"),
          bffFetch("/api/user/preferences"),
        ]);
        if (!voicesRes.ok) throw new Error(`voices ${voicesRes.status}`);
        const voicesPayload = (await voicesRes.json()) as { voices: VoicePickerVoice[] };
        if (!prefsRes.ok) throw new Error(`prefs ${prefsRes.status}`);
        const prefsPayload = (await prefsRes.json()) as PreferencesResponse;
        if (cancelled) return;
        setVoices(voicesPayload.voices);
        setPrefs(prefsPayload);
      } catch (err) {
        if (!cancelled) setError("Can't reach ReadMaxxing — retry");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrefs = React.useCallback(
    async (patch: Partial<PreferencesResponse>) => {
      setSaving(true);
      try {
        const res = await bffFetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`prefs PUT ${res.status}`);
        const next = (await res.json()) as PreferencesResponse;
        setPrefs(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-md font-semibold">Settings</h2>
      {error ? (
        <p className="rounded-md border border-border-subtle bg-card p-3 text-xs text-ink-muted">
          {error}
        </p>
      ) : null}
      <section aria-label="Default voice">
        <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-muted">Default voice</h3>
        {prefs ? (
          <VoicePicker
            voices={voices}
            value={prefs.defaultVoiceId}
            onChange={(voiceId) => updatePrefs({ defaultVoiceId: voiceId })}
          />
        ) : (
          <p className="text-xs text-ink-muted">Loading voices…</p>
        )}
      </section>
      <section aria-label="Playback speed">
        <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
          Default speed
        </h3>
        <div className="flex gap-2">
          {[0.75, 1, 1.25, 1.5, 2, 3].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => updatePrefs({ defaultSpeed: speed })}
              aria-pressed={prefs?.defaultSpeed === speed}
              disabled={saving}
              className="tabular inline-flex h-9 min-w-[3rem] items-center justify-center rounded-md border border-border px-2 text-xs data-[active=true]:bg-coral-bg data-[active=true]:text-white"
            >
              {speed}×
            </button>
          ))}
        </div>
      </section>
      {/* The `initialTab` prop keeps the route stable while letting the
          deep-link `/voice-clone` open the voices tab — see App.tsx. */}
      <p hidden={initialTab !== "voices"}>
        Voice cloning runs on the web app — open the full site to record a sample.
      </p>
    </div>
  );
}
