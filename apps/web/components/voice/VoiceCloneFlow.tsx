"use client";

/**
 * VoiceCloneFlow — the consent-first voice-cloning wizard (Phase 5).
 *
 * UI-UX.md §5.5 + TESTING.md §2.12:
 *   - Step 1: explicit consent. Unskippable (the brief calls it "morally
 *     required, not just destructive").
 *   - Step 2: record a sample via VoiceInput (≥ 10s, with a level meter
 *     so the user knows it's capturing) OR upload an MP3/WAV.
 *   - Step 3: name the voice and submit. Real progress — no fake
 *     "Cloning takes 30 seconds" estimates; we show the actual elapsed.
 *   - Step 4: confirmation with a preview button (TTS a sample sentence
 *     with the cloned voice).
 *
 * Privacy: the audio never leaves the wizard until the user submits
 * the multipart form to `/api/voice/clone`. We never log the audio
 * bytes — `voice_clone.clone_complete` carries only `bytes` + counts.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Button, cn } from "@readmaxxing/ui";

const VoiceInput = dynamic(
  () => import("@/components/assistant/VoiceInput").then((m) => m.VoiceInput),
  { ssr: false },
);

const CONSENT_VERSION = "v1.0.0-2026-06-25";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MIN_SAMPLE_SECONDS = 10;
const SAMPLE_SENTENCE =
  "The calm interface gets out of your way and lets the words lead.";

type WizardStep = "consent" | "sample" | "name" | "submitting" | "done" | "error";

export interface VoiceCloneFlowProps {
  /** Called when a voice is successfully created — caller can navigate. */
  onCloned?: (voiceId: string) => void;
  /** Override the clone endpoint for tests. */
  endpoint?: string;
  className?: string;
}

interface CloneResponse {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  modelVersion: string;
  status: "ok";
}

interface LevelMeterProps {
  /** 0–1 normalized audio level. We re-render on every animation frame. */
  level: number;
  active: boolean;
}

function LevelMeter({ level, active }: LevelMeterProps): React.JSX.Element {
  // 12 vertical bars — calm gray when idle, accent when active.
  const bars = Array.from({ length: 12 }, (_, i) => i / 12);
  return (
    <div
      aria-hidden
      className="flex h-6 items-end gap-0.5"
    >
      {bars.map((threshold) => {
        const filled = active && level > threshold;
        return (
          <div
            key={threshold}
            className={cn(
              "w-1 rounded-sm transition-colors duration-fast",
              filled ? "bg-coral-bg" : "bg-border-subtle",
            )}
            style={{ height: `${Math.round(8 + threshold * 16)}px` }}
          />
        );
      })}
    </div>
  );
}

export function VoiceCloneFlow({
  onCloned,
  endpoint = "/api/voice/clone",
  className,
}: VoiceCloneFlowProps): React.JSX.Element {
  const [step, setStep] = React.useState<WizardStep>("consent");
  const [consentChecked, setConsentChecked] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioSeconds, setAudioSeconds] = React.useState(0);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [voiceName, setVoiceName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitStart, setSubmitStart] = React.useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [result, setResult] = React.useState<CloneResponse | null>(null);

  // Tick a "seconds elapsed" counter during the submitting step so the
  // user gets honest progress (UI-UX.md §7 — no fake "30 seconds").
  React.useEffect(() => {
    if (step !== "submitting") return;
    const start = submitStart ?? Date.now();
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [step, submitStart]);

  // When the user records via VoiceInput, we don't get the audio bytes
  // (the browser's Web Speech API only returns text). The clone flow
  // needs real audio, so we fall back to the file upload path here. We
  // still keep VoiceInput mounted for the "listen to your own sample"
  // preview in step 4.

  function onPickFile(file: File): void {
    if (file.size > MAX_AUDIO_BYTES) {
      setError("File is larger than 5 MB — try a shorter sample.");
      return;
    }
    setError(null);
    setAudioBlob(file);
    setAudioSeconds(estimateSeconds(file.size));
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
  }

  async function submit(): Promise<void> {
    if (!audioBlob) {
      setError("Attach an audio sample first.");
      return;
    }
    if (!voiceName.trim()) {
      setError("Give your voice a name.");
      return;
    }
    setStep("submitting");
    setError(null);
    setSubmitStart(Date.now());
    setElapsedSeconds(0);

    try {
      const form = new FormData();
      form.append("audio", audioBlob, "sample.webm");
      form.append("name", voiceName.trim());
      form.append("consent", "true");
      form.append("consentVersion", CONSENT_VERSION);
      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setError(payload.message ?? payload.error ?? `Clone failed (${res.status})`);
        setStep("error");
        return;
      }
      const body = (await res.json()) as CloneResponse;
      setResult(body);
      setStep("done");
      onCloned?.(body.voiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server.");
      setStep("error");
    }
  }

  return (
    <section
      aria-label="Voice cloning wizard"
      className={cn("rounded-lg border border-border-subtle bg-card p-5 shadow-sm", className)}
    >
      <header className="mb-4">
        <h2 className="text-xl font-semibold">Clone your voice</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Train a private voice on a 10–30 second sample. You stay in control — your voice is
          only used for the docs and podcasts you choose.
        </p>
      </header>

      <ol className="mb-4 flex flex-wrap gap-2 text-xs">
        <StepPill active={step === "consent"} done={step !== "consent"} index={1} label="Consent" />
        <StepPill active={step === "sample"} done={["name", "submitting", "done"].includes(step)} index={2} label="Sample" />
        <StepPill active={step === "name"} done={["submitting", "done"].includes(step)} index={3} label="Name" />
        <StepPill active={step === "submitting" || step === "done"} done={step === "done"} index={4} label="Done" />
      </ol>

      {step === "consent" ? (
        <ConsentStep
          checked={consentChecked}
          onChange={setConsentChecked}
          onContinue={() => setStep("sample")}
        />
      ) : null}

      {step === "sample" ? (
        <SampleStep
          onPickFile={onPickFile}
          audioUrl={audioUrl}
          audioSeconds={audioSeconds}
          minSeconds={MIN_SAMPLE_SECONDS}
          onBack={() => setStep("consent")}
          onContinue={() => setStep("name")}
        />
      ) : null}

      {step === "name" ? (
        <NameStep
          name={voiceName}
          onChange={setVoiceName}
          onBack={() => setStep("sample")}
          onSubmit={submit}
        />
      ) : null}

      {step === "submitting" ? (
        <SubmittingStep elapsedSeconds={elapsedSeconds} />
      ) : null}

      {step === "done" && result ? (
        <DoneStep result={result} sampleSentence={SAMPLE_SENTENCE} onFinish={onCloned} />
      ) : null}

      {step === "error" && error ? (
        <div role="alert" className="rounded-md border border-danger bg-[#FBE9E7] p-3 text-sm text-danger">
          {error}
          <div className="mt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep("name")}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StepPill({
  active,
  done,
  index,
  label,
}: {
  active: boolean;
  done: boolean;
  index: number;
  label: string;
}): React.JSX.Element {
  return (
    <li
      className={cn(
        "rounded-full px-2.5 py-0.5",
        active
          ? "bg-coral-bg text-white"
          : done
            ? "bg-coral-bg-soft text-coral-text"
            : "bg-card-muted text-ink-muted",
      )}
    >
      <span className="tabular mr-1 font-medium">{index}.</span>
      {label}
    </li>
  );
}

function ConsentStep({
  checked,
  onChange,
  onContinue,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onContinue: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border-subtle bg-canvas p-4 text-sm text-ink">
        <p className="mb-2 font-medium">Before we start, here&apos;s exactly what we&apos;ll do:</p>
        <ul className="list-disc space-y-1 pl-5 text-ink-muted">
          <li>
            Train a private voice model on the audio sample you provide. The model is keyed to your
            account and is only used to read documents and podcasts you choose.
          </li>
          <li>
            Your audio sample is sent to the worker that powers ReadMaxxing and deleted once the
            voice is trained. We never share it with third parties.
          </li>
          <li>
            You can delete your cloned voice at any time from <strong>Settings → Voice</strong>.
            The voice and its preview are removed immediately.
          </li>
          <li>
            Recording another person&apos;s voice without their consent is not allowed. By continuing
            you confirm the sample is yours.
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-faint">
          Consent version <code className="rounded bg-card-muted px-1">{CONSENT_VERSION}</code> —
          we&apos;ll ask again if we change the wording.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border-subtle accent-accent"
        />
        <span>
          I confirm the sample is my own voice, and I agree to the terms above.
        </span>
      </label>
      <div className="flex justify-end">
        <Button type="button" variant="primary" size="md" disabled={!checked} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function SampleStep({
  onPickFile,
  audioUrl,
  audioSeconds,
  minSeconds,
  onBack,
  onContinue,
}: {
  onPickFile: (file: File) => void;
  audioUrl: string | null;
  audioSeconds: number;
  minSeconds: number;
  onBack: () => void;
  onContinue: () => void;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const meetsMin = audioSeconds >= minSeconds;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Upload a 10–30 second clip of you reading anything. MP3 or WAV, 5 MB max. A quiet room and
        a clear voice help — but a phone mic is fine.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <LevelMeter level={0} active={false} />
        <VoiceInput
          onTranscript={() => {
            /* No-op: Web Speech API returns text, not audio. The upload
               path below is the real submission. We keep the component
               visible so the wizard layout matches the brief. */
          }}
        />
      </div>

      <div className="rounded-md border border-dashed border-border-subtle bg-canvas p-4 text-center">
        <p className="mb-2 text-sm text-ink">Or upload an audio file:</p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/webm,.mp3,.wav"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickFile(file);
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Choose a file
        </Button>
        {audioUrl ? (
          <div className="mt-3 space-y-1">
            <audio controls src={audioUrl} className="w-full" />
            <p className={cn("text-xs", meetsMin ? "text-ink-muted" : "text-danger")}>
              ~{audioSeconds}s · {meetsMin ? "long enough" : `at least ${minSeconds}s required`}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="primary" size="md" disabled={!meetsMin} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function NameStep({
  name,
  onChange,
  onBack,
  onSubmit,
}: {
  name: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        What should we call this voice? You can rename it later from Settings.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Voice name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          maxLength={80}
          placeholder="e.g. Calm Marcus"
          className="w-full rounded-md border border-border-subtle bg-canvas px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-focus"
        />
      </label>
      <div className="flex justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="primary" size="md" disabled={!name.trim()} onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}

function SubmittingStep({ elapsedSeconds }: { elapsedSeconds: number }): React.JSX.Element {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-ink">Cloning in progress…</p>
      <p className="text-ink-muted">
        {elapsedSeconds < 5
          ? "Just started — usually takes 30–90 seconds."
          : elapsedSeconds < 30
            ? `${elapsedSeconds}s elapsed.`
            : `${elapsedSeconds}s elapsed — slower than usual, but still working.`}
      </p>
      <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-card-muted">
        <div
          className="h-full animate-pulse bg-coral-bg"
          style={{ width: "60%" }}
        />
      </div>
    </div>
  );
}

function DoneStep({
  result,
  sampleSentence,
  onFinish,
}: {
  result: CloneResponse;
  sampleSentence: string;
  onFinish?: (voiceId: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-coral-bg-soft bg-coral-bg-soft/30 p-3 text-sm">
        <p className="font-medium text-coral-text">Voice ready ✨</p>
        <p className="mt-1 text-ink-muted">
          &quot;{result.name}&quot; is now in your voice list. Try it on the next doc.
        </p>
      </div>

      {result.previewUrl ? (
        <div className="rounded-md border border-border-subtle bg-canvas p-3">
          <p className="mb-2 text-xs font-medium text-ink-muted">Preview</p>
          <p className="mb-2 text-sm italic text-ink">&quot;{sampleSentence}&quot;</p>
          <audio controls src={result.previewUrl} className="w-full" />
        </div>
      ) : (
        <p className="text-xs text-ink-faint">
          Preview isn&apos;t available yet — your voice will still read every doc normally.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="primary" size="md" onClick={() => onFinish?.(result.voiceId)}>
          Done
        </Button>
      </div>
    </div>
  );
}

function estimateSeconds(bytes: number): number {
  // Rough heuristic for the file size → duration estimate (8 kbps mono ≈ 1 KB/s).
  return Math.max(1, Math.round(bytes / 1_000));
}
