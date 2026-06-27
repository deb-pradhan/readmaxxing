"use client";

/**
 * /settings — Settings page (re-skinned to the M-Chef system).
 *
 * Per DESIGN-SYSTEM §6 / §11:
 *   - Sectioned rows grouped in cards.
 *   - Switches + chevrons for primary actions.
 *   - 20px card radius + 24px padding default.
 *   - No serif — Inter throughout.
 */

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Eyebrow,
  cn,
  type VoicePickerVoice,
  VoicePicker,
} from "@readmaxxing/ui";
import { AppHeader } from "@/components/shared/AppHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

type Theme = "light" | "dark" | "sepia" | "eink" | "system";
type GoalMetric = "minutes" | "words" | "articles";

interface UserPreferences {
  displayName: string | null;
  defaultVoiceId: string;
  theme: Theme;
  fontSize: number;
  lineSpacing: number;
  measure: number;
  bionic: boolean;
  bionicFixation: number;
  bionicOpacity: number;
  defaultSpeed: number;
  defaultGoalMetric: GoalMetric;
  defaultGoalValue: number;
  focusModeDefault: boolean;
  skipFillerDefault: boolean;
  reminderTime: string | null;
  leaderboardOptIn: boolean;
  freezesAvailable: number;
  language: string;
  cacheLocalIndexedDb: boolean;
  downloadedAudioKept: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

const DEFAULTS: UserPreferences = {
  displayName: null,
  defaultVoiceId: "Xb7hH8MSUJpSbSDYk0k2",
  theme: "light",
  fontSize: 15,
  lineSpacing: 1.5,
  measure: 66,
  bionic: false,
  bionicFixation: 0.4,
  bionicOpacity: 0.85,
  defaultSpeed: 1,
  defaultGoalMetric: "minutes",
  defaultGoalValue: 15,
  focusModeDefault: false,
  skipFillerDefault: false,
  reminderTime: null,
  leaderboardOptIn: true,
  freezesAvailable: 1,
  language: "en",
  cacheLocalIndexedDb: true,
  downloadedAudioKept: true,
  reducedMotion: false,
  highContrast: false,
};

const SAMPLE_VOICES: VoicePickerVoice[] = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", isMarquee: true },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
];

const APP_VERSION = "0.6.0";

export default function SettingsPage(): React.JSX.Element {
  const [prefs, setPrefs] = React.useState<UserPreferences>(DEFAULTS);
  const [savedKeys, setSavedKeys] = React.useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Phase E (E.4): in-page confirmation dialogs replace every
   * `alert()` call. Each action gets its own dialog so the title,
   * description, and intent (`destructive` for the irreversible ones)
   * can be tuned per action. None of these block reading flow — they
   * only appear when the user explicitly opts in by clicking the
   * trigger.
   */
  const [confirmLogOut, setConfirmLogOut] = React.useState(false);
  const [confirmClearCache, setConfirmClearCache] = React.useState(false);
  const [confirmExport, setConfirmExport] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  // Auto-dismiss the inline info toast after 4s.
  React.useEffect(() => {
    if (!info) return;
    const id = window.setTimeout(() => setInfo(null), 4000);
    return () => window.clearTimeout(id);
  }, [info]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/preferences", { credentials: "include" });
        if (!res.ok) throw new Error(`preferences ${res.status}`);
        const body = (await res.json()) as Partial<UserPreferences>;
        if (!cancelled) setPrefs({ ...DEFAULTS, ...body });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load preferences.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(key: string, patch: Partial<UserPreferences>): Promise<void> {
    setSavingKey(key);
    setError(null);
    const optimistic = { ...prefs, ...patch };
    setPrefs(optimistic);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`save_failed: ${res.status}`);
      setSavedKeys((prev) => new Set(prev).add(key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader section="Settings">
        <ThemeSwitcher />
      </AppHeader>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        {/* Phase F (F.2) v2 page header pattern. */}
        <header className="flex flex-col gap-1">
          <Eyebrow as="p">Settings</Eyebrow>
          <h1 className="mt-1 text-[clamp(34px,8vw,52px)] font-extrabold leading-[1] tracking-[-0.035em]">
            Settings
          </h1>
          <p className="mt-3 text-[17px] font-medium leading-snug text-ink-muted sm:text-[18px]">
            Tune your reading. Changes save per section, optimistic — you can leave any time.
          </p>
        </header>

        {error ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Section
        title="Account"
        description="The email and display name attached to your Privy login."
        saving={savingKey === "account"}
        saved={savedKeys.has("account")}
        onSave={() => save("account", { displayName: prefs.displayName })}
      >
        <Field label="Display name">
          <input
            type="text"
            value={prefs.displayName ?? ""}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            maxLength={80}
            className="h-12 w-full rounded-md border border-border bg-card px-4 text-base text-ink placeholder:text-ink-faint transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus"
            placeholder="Anonymous reader"
          />
        </Field>
        <Field label="Email">
          <p className="tabular text-sm text-ink-muted">
            Linked to your Privy account. Sign out below to switch.
          </p>
        </Field>
        <Button type="button" variant="ghost" onClick={() => setConfirmLogOut(true)}>
          Log out
        </Button>
      </Section>

      <Section
        title="Voice"
        description="Default voice for new docs. Cloned voices are private to you."
        saving={savingKey === "voice"}
        saved={savedKeys.has("voice")}
        onSave={() => save("voice", { defaultVoiceId: prefs.defaultVoiceId })}
      >
        <VoicePicker
          voices={SAMPLE_VOICES}
          value={prefs.defaultVoiceId}
          onChange={(id) => setPrefs({ ...prefs, defaultVoiceId: id })}
          onPreview={async () => null}
        />
        <p className="text-xs text-ink-muted">
          Want a voice that&apos;s yours? <Link href="/voice" className="underline">Clone one</Link>.
        </p>
      </Section>

      <Section
        title="Theme"
        description="Light, Dark, Sepia, or E-ink. E-ink is a calm grayscale mode for long sessions."
        saving={savingKey === "theme"}
        saved={savedKeys.has("theme")}
        onSave={() => save("theme", { theme: prefs.theme })}
      >
        <Segmented
          value={prefs.theme}
          onChange={(v) => setPrefs({ ...prefs, theme: v as Theme })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "sepia", label: "Sepia" },
            { value: "eink", label: "E-ink" },
            { value: "system", label: "Auto" },
          ]}
        />
      </Section>

      <Section
        title="Typography"
        description="Inter is the only font family. Tune size, line spacing, and measure."
        saving={savingKey === "typography"}
        saved={savedKeys.has("typography")}
        onSave={() =>
          save("typography", {
            fontSize: prefs.fontSize,
            lineSpacing: prefs.lineSpacing,
            measure: prefs.measure,
            bionic: prefs.bionic,
            bionicFixation: prefs.bionicFixation,
            bionicOpacity: prefs.bionicOpacity,
          })
        }
      >
        <SliderField
          label={`Body size: ${prefs.fontSize}px`}
          min={14}
          max={22}
          step={1}
          value={prefs.fontSize}
          onChange={(v) => setPrefs({ ...prefs, fontSize: v })}
        />
        <SliderField
          label={`Line spacing: ${prefs.lineSpacing.toFixed(2)}`}
          min={1.3}
          max={1.8}
          step={0.05}
          value={prefs.lineSpacing}
          onChange={(v) => setPrefs({ ...prefs, lineSpacing: v })}
        />
        <SliderField
          label={`Measure: ${prefs.measure}ch`}
          min={60}
          max={80}
          step={1}
          value={prefs.measure}
          onChange={(v) => setPrefs({ ...prefs, measure: v })}
        />
        <Toggle
          label="Bionic reading"
          description="Bold the first letters of each word to create saccade anchors."
          checked={prefs.bionic}
          onChange={(v) => setPrefs({ ...prefs, bionic: v })}
        />
        {prefs.bionic ? (
          <>
            <SliderField
              label={`Fixation: ${Math.round(prefs.bionicFixation * 100)}%`}
              min={0.1}
              max={0.7}
              step={0.05}
              value={prefs.bionicFixation}
              onChange={(v) => setPrefs({ ...prefs, bionicFixation: v })}
            />
            <SliderField
              label={`Opacity: ${Math.round(prefs.bionicOpacity * 100)}%`}
              min={0.1}
              max={1}
              step={0.05}
              value={prefs.bionicOpacity}
              onChange={(v) => setPrefs({ ...prefs, bionicOpacity: v })}
            />
          </>
        ) : null}
      </Section>

      <Section
        title="Reading"
        description="Defaults for new docs. Per-doc overrides win when you change them."
        saving={savingKey === "reading"}
        saved={savedKeys.has("reading")}
        onSave={() =>
          save("reading", {
            defaultSpeed: prefs.defaultSpeed,
            defaultGoalMetric: prefs.defaultGoalMetric,
            defaultGoalValue: prefs.defaultGoalValue,
            focusModeDefault: prefs.focusModeDefault,
            skipFillerDefault: prefs.skipFillerDefault,
          })
        }
      >
        <SliderField
          label={`Default speed: ${prefs.defaultSpeed.toFixed(2)}×`}
          min={0.5}
          max={4.5}
          step={0.1}
          value={prefs.defaultSpeed}
          onChange={(v) => setPrefs({ ...prefs, defaultSpeed: v })}
        />
        <Field label="Daily goal">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Segmented
              value={prefs.defaultGoalMetric}
              onChange={(v) => setPrefs({ ...prefs, defaultGoalMetric: v as GoalMetric })}
              options={[
                { value: "minutes", label: "Minutes" },
                { value: "words", label: "Words" },
                { value: "articles", label: "Articles" },
              ]}
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={prefs.defaultGoalValue}
              onChange={(e) => setPrefs({ ...prefs, defaultGoalValue: Number(e.target.value) || 1 })}
              className="h-12 w-full rounded-md border border-border bg-card px-4 text-base tabular text-ink transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus sm:w-24"
            />
          </div>
        </Field>
        <Toggle
          label="Focus mode on by default"
          description="Dim non-current paragraphs from the start of every doc."
          checked={prefs.focusModeDefault}
          onChange={(v) => setPrefs({ ...prefs, focusModeDefault: v })}
        />
        <Toggle
          label="Skip filler sentences"
          description="Auto-skip transitions and throat-clearing detected by the AI."
          checked={prefs.skipFillerDefault}
          onChange={(v) => setPrefs({ ...prefs, skipFillerDefault: v })}
        />
      </Section>

      <Section
        title="Habit"
        description="Streaks, leaderboards, and reminders."
        saving={savingKey === "habit"}
        saved={savedKeys.has("habit")}
        onSave={() =>
          save("habit", {
            reminderTime: prefs.reminderTime,
            leaderboardOptIn: prefs.leaderboardOptIn,
            freezesAvailable: prefs.freezesAvailable,
            language: prefs.language,
          })
        }
      >
        <Field label="Reminder time">
          <input
            type="time"
            value={prefs.reminderTime ?? ""}
            onChange={(e) => setPrefs({ ...prefs, reminderTime: e.target.value || null })}
            className="h-12 w-full rounded-md border border-border bg-card px-4 text-base tabular text-ink transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus sm:w-48"
          />
        </Field>
        <Toggle
          label="Show me on the leaderboard"
          description="One-tap private mode. You'll never be shamed for opting out."
          checked={prefs.leaderboardOptIn}
          onChange={(v) => setPrefs({ ...prefs, leaderboardOptIn: v })}
        />
        <SliderField
          label={`Streak freezes available: ${prefs.freezesAvailable}`}
          min={0}
          max={3}
          step={1}
          value={prefs.freezesAvailable}
          onChange={(v) => setPrefs({ ...prefs, freezesAvailable: v })}
        />
        <Field label="Language">
          <input
            type="text"
            value={prefs.language}
            onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
            maxLength={8}
            className="h-12 w-full rounded-md border border-border bg-card px-4 text-base text-ink transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus sm:w-32"
          />
        </Field>
      </Section>

      <Section
        title="Privacy"
        description="Your reading stays on your device unless you opt in."
        noSave
      >
        <ul className="space-y-1 text-sm text-ink-muted">
          <li>• {prefs.cacheLocalIndexedDb ? "Keeping" : "Not keeping"} local IndexedDB cache</li>
          <li>• {prefs.downloadedAudioKept ? "Keeping" : "Discarding"} downloaded audio</li>
          <li>• Raw uploads never leave your device</li>
        </ul>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setConfirmClearCache(true)}
        >
          Clear local IndexedDB cache
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmExport(true)}
        >
          Download my data (coming soon)
        </Button>
      </Section>

      <Section
        title="Accessibility"
        description="Motion and contrast options."
        saving={savingKey === "accessibility"}
        saved={savedKeys.has("accessibility")}
        onSave={() =>
          save("accessibility", {
            reducedMotion: prefs.reducedMotion,
            highContrast: prefs.highContrast,
          })
        }
      >
        <Toggle
          label="Reduced motion"
          description="Disable non-essential motion — karaoke, auto-scroll, glow effects."
          checked={prefs.reducedMotion}
          onChange={(v) => setPrefs({ ...prefs, reducedMotion: v })}
        />
        <Toggle
          label="High contrast"
          description="Stronger borders + text contrast for low-vision reading."
          checked={prefs.highContrast}
          onChange={(v) => setPrefs({ ...prefs, highContrast: v })}
        />
      </Section>

      <Section title="About" description="Version, links, and feedback." noSave>
        <p className="text-sm text-ink-muted">
          ReadMaxxing v{APP_VERSION} — Phase 6 (Voice Typing, Voice Cloning, OCR, Habit Layer)
        </p>
        <ul className="text-sm text-ink-muted">
          <li>
            <a className="underline" href="mailto:hello@readmaxxing.app">
              Send feedback
            </a>
          </li>
          <li>
            <a className="underline" href="/docs/DESIGN-SYSTEM.md" target="_blank" rel="noreferrer">
              Design law (DESIGN-SYSTEM.md)
            </a>
          </li>
        </ul>
        </Section>
      </main>

      {/* Phase E (E.4): in-page confirmation dialogs. Each destructive
          action gets its own `ConfirmDialog` so the title, description,
          and intent stay tuned to the action. Default focus lands on
          Cancel; the Confirm button is `secondary` (not coral) for the
          destructive ones so it doesn't read as triumphant (D31). */}
      <ConfirmDialog
        open={confirmLogOut}
        onOpenChange={setConfirmLogOut}
        title="Log out of ReadMaxxing?"
        description="You'll need to sign back in to access your library and reading progress."
        confirmLabel="Log out"
        intent="destructive"
        onConfirm={() => {
          // Real logout wiring lives in the auth provider. Until it
          // ships we surface a friendly note rather than a dev-coded
          // `alert()`.
          setInfo("Logout is wired in the auth provider.");
        }}
      />
      <ConfirmDialog
        open={confirmClearCache}
        onOpenChange={setConfirmClearCache}
        title="Clear local IndexedDB cache?"
        description="This removes downloaded audio and offline reading state from this device. Your library and cloud positions are not affected."
        confirmLabel="Clear cache"
        intent="destructive"
        onConfirm={async () => {
          try {
            await indexedDB.deleteDatabase("readmaxxing");
            setInfo("Local cache cleared.");
          } catch {
            setError("Couldn't clear the cache.");
          }
        }}
      />
      <ConfirmDialog
        open={confirmExport}
        onOpenChange={setConfirmExport}
        title="Data export isn't available yet"
        description="Exporting your library and reading history is coming in a follow-up. We'll let you know when it ships."
        confirmLabel="Got it"
        intent="default"
      />

      {info ? (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm text-ink shadow-soft"
        >
          {info}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
  onSave,
  saving,
  saved,
  noSave,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
  noSave?: boolean;
}): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-border-subtle bg-card p-5 sm:p-6"
    >
      <div className="mb-4 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
      {noSave ? null : (
        <div className="mt-5 flex justify-end border-t border-border-subtle pt-4">
          <Button
            type="button"
            size="md"
            variant={saved ? "secondary" : "primary"}
            onClick={onSave}
            loading={saving}
          >
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-coral-bg" : "bg-card-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-coral-bg"
      />
    </label>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}): React.JSX.Element {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-ink text-canvas"
              : "border border-border bg-card text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}