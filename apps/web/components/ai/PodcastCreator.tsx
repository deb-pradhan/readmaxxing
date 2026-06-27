"use client";

/**
 * PodcastCreator — Phase 4 podcast generator UI.
 *
 * Per UI-UX.md §7 the progress is honest: each of the four stages
 * (Reading → Writing → Casting → Producing) is its own card with real
 * elapsed time + a moving-window ETA based on the actual durations of
 * completed stages. We never fake "2 seconds" when the cast takes 90.
 *
 * Variable-reward payoff (UI-UX.md §7) on completion: success toast +
 * deep-link to the episode page. On failure: human error + retry
 * affordance; never a dead-end (UI-UX.md §11).
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@readmaxxing/ui";

export type PodcastStyleKey = "podcast" | "late_night" | "debate" | "lecture";

interface PodcastStyleOption {
  key: PodcastStyleKey;
  label: string;
  description: string;
}

export const PODCAST_STYLES: PodcastStyleOption[] = [
  {
    key: "podcast",
    label: "Podcast",
    description: "Two hosts in a casual, curious conversation.",
  },
  {
    key: "late_night",
    label: "Late Night",
    description: "Two hosts in an intimate late-night radio format.",
  },
  {
    key: "debate",
    label: "Debate",
    description: "Opposing viewpoints debating the topic.",
  },
  {
    key: "lecture",
    label: "Lecture",
    description: "A single expert lecturer walking you through it.",
  },
];

const STAGE_NAMES = [
  "reading_doc",
  "writing_script",
  "casting_voices",
  "producing_audio",
] as const;

type StageName = (typeof STAGE_NAMES)[number];

const STAGE_LABELS: Record<StageName, string> = {
  reading_doc: "Reading the document",
  writing_script: "Writing the script",
  casting_voices: "Casting voices",
  producing_audio: "Producing the audio",
};

export interface DocumentOption {
  id: string;
  title: string;
}

export interface PodcastCreatorProps {
  /** Saved documents to pick from (optional). */
  documents?: DocumentOption[];
  /** Pre-select a document (the reader page can pass its current docId). */
  initialDocumentId?: string;
  /** Override the POST endpoint for tests. */
  endpoint?: string;
  /** Called after the episode is ready — parent can navigate. */
  onCreated?: (payload: { episodeId: string; title: string }) => void;
  className?: string;
}

interface StageState {
  status: "pending" | "active" | "complete" | "error";
  startedAt: number | null;
  durationMs: number | null;
}

interface CreatorState {
  source: "doc" | "prompt";
  documentId: string;
  prompt: string;
  style: PodcastStyleKey;
  title: string;
  running: boolean;
  episodeId: string | null;
  error: string | null;
  stages: Record<StageName, StageState>;
  overallStartedAt: number | null;
  /** Moving-window duration estimate per stage (ms) updated after each
   *  stage completes. Null until we have at least one measurement. */
  stageDurations: Partial<Record<StageName, number>>;
  /** Set to true once the server returned the episode row (terminal). */
  finished: boolean;
}

const INITIAL_STAGES = (): Record<StageName, StageState> => ({
  reading_doc: { status: "pending", startedAt: null, durationMs: null },
  writing_script: { status: "pending", startedAt: null, durationMs: null },
  casting_voices: { status: "pending", startedAt: null, durationMs: null },
  producing_audio: { status: "pending", startedAt: null, durationMs: null },
});

export function PodcastCreator({
  documents = [],
  initialDocumentId,
  endpoint = "/api/ai/podcasts",
  onCreated,
  className,
}: PodcastCreatorProps): React.JSX.Element {
  const [state, setState] = React.useState<CreatorState>({
    source: documents.length > 0 ? "doc" : "prompt",
    documentId: initialDocumentId ?? documents[0]?.id ?? "",
    prompt: "",
    style: "podcast",
    title: "",
    running: false,
    episodeId: null,
    error: null,
    stages: INITIAL_STAGES(),
    overallStartedAt: null,
    stageDurations: {},
    finished: false,
  });

  // Real elapsed ticker — updates every 500ms while a job is running so
  // the "elapsed" readout is honest. UI-UX.md §7 (no fake estimates).
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.running]);

  function markStage(stage: StageName, patch: Partial<StageState>): void {
    setState((s) => ({
      ...s,
      stages: { ...s.stages, [stage]: { ...s.stages[stage], ...patch } },
    }));
  }

  async function start(): Promise<void> {
    setState((s) => ({
      ...s,
      running: true,
      error: null,
      finished: false,
      episodeId: null,
      overallStartedAt: Date.now(),
      stages: INITIAL_STAGES(),
    }));

    // Optimistically activate the first stage so the UI shows immediate
    // feedback (UI-UX.md §7 — no indeterminate spinner for ≥ 2s jobs).
    markStage("reading_doc", { status: "active", startedAt: Date.now() });

    const payload =
      state.source === "doc"
        ? {
            documentId: state.documentId,
            style: state.style,
            title: state.title || undefined,
          }
        : {
            prompt: state.prompt,
            style: state.style,
            title: state.title || undefined,
          };

    let episodeId: string | null = null;
    let responseStatus = "queued";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        episode?: { id?: string; status?: string };
        episodeId?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
      }
      episodeId = data.episode?.id ?? data.episodeId ?? null;
      responseStatus = data.episode?.status ?? "queued";
      if (!episodeId) {
        throw new Error("Podcast service did not return an episode id.");
      }
    } catch (err) {
      const message = (err as Error).message || "Couldn't create the podcast.";
      setState((s) => ({
        ...s,
        running: false,
        error: message,
        stages: mapStagesWithError(s.stages),
      }));
      return;
    }

    setState((s) => ({ ...s, episodeId }));
    onCreated?.({ episodeId, title: state.title || "Untitled podcast" });

    // Subscribe to SSE progress — this is the honest-time path.
    const eventsUrl = `${endpoint}/${episodeId}/progress`;
    try {
      const res = await fetch(eventsUrl, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        throw new Error(`Progress stream unavailable (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let terminal = false;
      while (!terminal) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          const { event, data } = parseSseFrame(frame);
          if (event === "completed") {
            handleStageEvent("producing_audio", { status: "complete", durationMs: Date.now() - (state.overallStartedAt ?? Date.now()) });
            handleTerminal("completed");
            terminal = true;
            break;
          }
          if (event === "failed") {
            handleTerminal("failed");
            terminal = true;
            break;
          }
          if (event === "error") {
            handleTerminal("error", data?.message ?? "worker error");
            terminal = true;
            break;
          }
          if (event && STAGE_NAMES.includes(event as StageName)) {
            const stageName = event as StageName;
            const durationMs = typeof data?.duration_ms === "number" ? data.duration_ms : null;
            const stageActive = durationMs != null && (data?.status ?? "ok") === "ok";
            handleStageEvent(stageName, {
              status: stageActive ? "complete" : "active",
              durationMs,
            });
            // Move the next stage to "active" if we got a complete for this one.
            if (stageActive) {
              const idx = STAGE_NAMES.indexOf(stageName);
              const next = STAGE_NAMES[idx + 1];
              if (next) {
                markStage(next, { status: "active", startedAt: Date.now() });
              }
            }
          }
        }
      }
    } catch (err) {
      // Stream error — fall back to the DB status we already know.
      // The episode row already says "queued" / "completed" / "failed".
      handleTerminal(responseStatus === "completed" ? "completed" : "error", (err as Error).message);
    }
  }

  function handleStageEvent(stage: StageName, patch: Partial<StageState>): void {
    setState((s) => {
      const now = Date.now();
      const prev = s.stages[stage];
      const startedAt = prev.startedAt ?? now;
      const newDuration =
        patch.durationMs != null
          ? patch.durationMs
          : prev.durationMs != null
            ? prev.durationMs
            : prev.status === "active"
              ? now - startedAt
              : null;
      const updatedStage: StageState = {
        status: patch.status ?? prev.status,
        startedAt,
        durationMs: newDuration,
      };
      const newStages = { ...s.stages, [stage]: updatedStage };
      const newDurations = { ...s.stageDurations };
      if (patch.status === "complete" && newDuration != null) {
        newDurations[stage] = newDuration;
      }
      return { ...s, stages: newStages, stageDurations: newDurations };
    });
  }

  function handleTerminal(kind: "completed" | "failed" | "error", message?: string): void {
    setState((s) => ({
      ...s,
      running: false,
      finished: kind === "completed",
      error:
        kind === "failed" || kind === "error"
          ? message ?? "Couldn't finish the podcast."
          : s.error,
      stages:
        kind === "completed"
          ? mapStagesAllComplete(s.stages)
          : kind === "failed"
            ? mapStagesWithError(s.stages)
            : s.stages,
    }));
  }

  const totalElapsedMs = state.overallStartedAt ? now - state.overallStartedAt : 0;
  const remainingMs = estimateRemaining(state.stages, state.stageDurations);

  return (
    <section
      aria-label="Podcast creator"
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
        className,
      )}
    >
      <header className="mb-4">
        <h2 className="text-xl font-semibold">Create a podcast</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Turn any document into a short audio show. Honest progress — no fake
          countdowns.
        </p>
      </header>

      {!state.running && !state.finished ? (
        <CreatorForm
          state={state}
          setState={setState}
          documents={documents}
          onStart={start}
        />
      ) : null}

      {state.running ? (
        <StageList
          stages={state.stages}
          totalElapsedMs={totalElapsedMs}
          remainingMs={remainingMs}
        />
      ) : null}

      {state.finished && state.episodeId ? (
        <CompletionCard episodeId={state.episodeId} title={state.title} />
      ) : null}

      {state.error ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger"
        >
          <p>{state.error}</p>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                running: false,
                finished: false,
                error: null,
                stages: INITIAL_STAGES(),
                stageDurations: {},
              }))
            }
            className="mt-2 inline-flex h-9 items-center rounded-md border border-danger px-3 text-xs font-medium text-danger hover:bg-danger hover:text-white"
          >
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form (rendered when idle)
// ---------------------------------------------------------------------------

function CreatorForm({
  state,
  setState,
  documents,
  onStart,
}: {
  state: CreatorState;
  setState: React.Dispatch<React.SetStateAction<CreatorState>>;
  documents: DocumentOption[];
  onStart: () => void;
}): React.JSX.Element {
  const canStart =
    (state.source === "doc" ? state.documentId.length > 0 : state.prompt.trim().length > 0) &&
    !state.running;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Style</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PODCAST_STYLES.map((s) => {
            const active = state.style === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, style: s.key }))
                }
                aria-pressed={active}
                className={cn(
                  "rounded-md border px-3 py-3 text-left transition-colors duration-fast",
                  active
                    ? "border-coral-bg bg-coral-soft"
                    : "border-border-subtle bg-card hover:bg-card-muted",
                )}
              >
                <div className="text-sm font-medium">{s.label}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{s.description}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Source</legend>
        <div className="flex gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={state.source === "doc"}
            disabled={documents.length === 0}
            onClick={() => setState((s) => ({ ...s, source: "doc" }))}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              state.source === "doc"
                ? "bg-coral-bg text-white"
                : "border border-border-subtle text-ink-muted hover:bg-card-muted",
              documents.length === 0 ? "opacity-40" : "",
            )}
          >
            From a document
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={state.source === "prompt"}
            onClick={() => setState((s) => ({ ...s, source: "prompt" }))}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              state.source === "prompt"
                ? "bg-coral-bg text-white"
                : "border border-border-subtle text-ink-muted hover:bg-card-muted",
            )}
          >
            From a prompt
          </button>
        </div>

        {state.source === "doc" ? (
          <select
            value={state.documentId}
            onChange={(e) =>
              setState((s) => ({ ...s, documentId: e.target.value }))
            }
            className="mt-2 h-11 w-full rounded-md border border-border-subtle bg-canvas px-3 text-sm focus-visible:shadow-focus"
            aria-label="Document"
          >
            {documents.length === 0 ? (
              <option value="">No documents available</option>
            ) : null}
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            value={state.prompt}
            onChange={(e) => setState((s) => ({ ...s, prompt: e.target.value }))}
            placeholder="Paste a topic, an outline, or a short brief…"
            rows={4}
            className="mt-2 w-full rounded-md border border-border-subtle bg-canvas px-3 py-2 text-sm focus-visible:shadow-focus"
          />
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Title (optional)</span>
        <input
          type="text"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          placeholder="Untitled podcast"
          maxLength={200}
          className="h-11 w-full rounded-md border border-border-subtle bg-canvas px-3 text-sm focus-visible:shadow-focus"
        />
      </label>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-coral-bg text-sm font-medium text-white transition-transform duration-fast ease-out hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 focus-visible:shadow-focus"
      >
        Create podcast
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage list — honest progress, one card per stage.
// ---------------------------------------------------------------------------

function StageList({
  stages,
  totalElapsedMs,
  remainingMs,
}: {
  stages: Record<StageName, StageState>;
  totalElapsedMs: number;
  remainingMs: number | null;
}): React.JSX.Element {
  return (
    <div className="space-y-3" aria-label="Podcast progress">
      <ul className="space-y-2">
        {STAGE_NAMES.map((name) => (
          <StageCard
            key={name}
            stage={name}
            state={stages[name]}
            totalElapsedMs={totalElapsedMs}
          />
        ))}
      </ul>
      <p
        aria-live="polite"
        className="tabular flex items-center justify-between text-xs text-ink-muted"
      >
        <span>
          Total elapsed: <strong className="text-ink">{formatDuration(totalElapsedMs)}</strong>
        </span>
        <span>
          {remainingMs != null ? (
            <>
              Roughly <strong className="text-ink">{formatDuration(remainingMs)}</strong> left
            </>
          ) : (
            "Calibrating…"
          )}
        </span>
      </p>
    </div>
  );
}

function StageCard({
  stage,
  state,
  totalElapsedMs,
}: {
  stage: StageName;
  state: StageState;
  totalElapsedMs: number;
}): React.JSX.Element {
  const isActive = state.status === "active";
  const isComplete = state.status === "complete";
  const isError = state.status === "error";
  const elapsedMs = isComplete
    ? state.durationMs ?? 0
    : isActive
      ? Date.now() - (state.startedAt ?? Date.now())
      : 0;
  return (
    <li
      data-stage={stage}
      data-status={state.status}
      className={cn(
        "flex items-center gap-3 rounded-md border p-3 transition-colors duration-fast",
        isActive
          ? "border-coral-bg bg-coral-soft"
          : isComplete
            ? "border-border-subtle bg-card-muted/50"
            : isError
              ? "border-danger/40 bg-danger-soft"
              : "border-border-subtle bg-card",
      )}
    >
      <StageIcon status={state.status} />
      <div className="flex-1">
        <p className="text-sm font-medium">{STAGE_LABELS[stage]}</p>
        <p
          aria-live="polite"
          className="tabular text-xs text-ink-muted"
        >
          {isComplete
            ? `Done in ${formatDuration(elapsedMs)}`
            : isActive
              ? `Working… ${formatDuration(elapsedMs)} elapsed`
              : isError
                ? "Failed"
                : "Queued"}
        </p>
      </div>
      {isActive ? (
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-coral-bg" />
      ) : null}
    </li>
  );
}

function StageIcon({ status }: { status: StageState["status"] }): React.JSX.Element {
  if (status === "complete") {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-coral-bg text-white"
      >
        <CheckIcon />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-coral-bg text-accent"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-coral-bg" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-danger bg-danger-soft text-danger"
      >
        !
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle text-ink-faint"
    >
      <DotIcon />
    </span>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function DotIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Completion card
// ---------------------------------------------------------------------------

function CompletionCard({
  episodeId,
  title,
}: {
  episodeId: string;
  title: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="rounded-md border border-coral-bg bg-coral-soft p-4 text-sm text-ink"
    >
      <p className="font-medium">Your podcast is ready — “{title || "Untitled podcast"}”.</p>
      <p className="mt-1 text-ink-muted">Variable reward unlocked — go give it a listen.</p>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/podcasts/${episodeId}`}
          className="inline-flex h-11 items-center rounded-md bg-coral-bg px-4 text-sm font-medium text-white hover:scale-[1.01] focus-visible:shadow-focus"
        >
          Listen now →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSseFrame(frame: string): {
  event: string | null;
  data: { duration_ms?: number; status?: string; message?: string } | null;
} {
  const lines = frame.split("\n");
  let event: string | null = null;
  let dataStr = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) event = line.slice("event: ".length).trim();
    else if (line.startsWith("data: ")) dataStr += line.slice("data: ".length).trim();
    else if (line.startsWith(":")) continue;
  }
  if (!event) return { event: null, data: null };
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: null };
  }
}

function mapStagesWithError(stages: Record<StageName, StageState>): Record<StageName, StageState> {
  const out = { ...stages };
  for (const name of STAGE_NAMES) {
    const cur = out[name];
    if (cur.status === "active") {
      out[name] = { ...cur, status: "error", durationMs: cur.durationMs ?? Date.now() - (cur.startedAt ?? Date.now()) };
    }
  }
  return out;
}

function mapStagesAllComplete(stages: Record<StageName, StageState>): Record<StageName, StageState> {
  const out = { ...stages };
  for (const name of STAGE_NAMES) {
    const cur = out[name];
    if (cur.status !== "complete") {
      out[name] = { status: "complete", durationMs: cur.durationMs ?? 0, startedAt: cur.startedAt };
    }
  }
  return out;
}

/**
 * Estimate the remaining time using the durations of the stages that have
 * already completed + a one-step moving average for the active stage. This
 * is the honest-time path from UI-UX.md §7: never a static "2 seconds"
 * (TESTING.md §3 non-negotiable #7).
 */
function estimateRemaining(
  stages: Record<StageName, StageState>,
  durations: Partial<Record<StageName, number>>,
): number | null {
  const completed = STAGE_NAMES.filter((n) => stages[n].status === "complete");
  if (completed.length === 0) return null;
  const completedDurations = completed
    .map((n) => durations[n] ?? 0)
    .filter((d) => d > 0);
  if (completedDurations.length === 0) return null;
  const avg = completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length;
  const remainingStages = STAGE_NAMES.filter(
    (n) => stages[n].status !== "complete",
  ).length;
  return Math.max(0, Math.round(avg * remainingStages));
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}