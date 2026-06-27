"use client";

/**
 * /dictation — voice-typing workspace.
 *
 * Per DESIGN-SYSTEM §11 (Components) + §17 (states):
 *   - Full-width editor on a white card on canvas.
 *   - Diff view shows changes with **mint** for additions
 *     and **danger** for removals.
 *   - Honest latency — "Cleaning up…" while the model runs.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button, Eyebrow, cn } from "@readmaxxing/ui";
import { AppHeader } from "@/components/shared/AppHeader";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

const VoiceInput = dynamic(
  () => import("@/components/assistant/VoiceInput").then((m) => m.VoiceInput),
  { ssr: false },
);

interface DiffOp {
  text: string;
  op: "unchanged" | "removed" | "added";
}

interface CleanupResponse {
  cleaned: string;
  diff: DiffOp[];
}

type CleanupState =
  | { kind: "idle" }
  | { kind: "loading"; startedAt: number }
  | { kind: "ok"; response: CleanupResponse; perChange: boolean[] }
  | { kind: "error"; message: string };

const WORDS_PER_MINUTE = 155;

function wordCount(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function readingTimeSeconds(s: string): number {
  return Math.max(1, Math.round((wordCount(s) / WORDS_PER_MINUTE) * 60));
}

function lineNumberedPreview(text: string): Array<{ lineNo: number; text: string }> {
  const lines = text.split("\n");
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return [{ lineNo: 1, text: "" }];
  }
  return lines.map((line, idx) => ({ lineNo: idx + 1, text: line }));
}

export default function DictationPage(): React.JSX.Element {
  const [original, setOriginal] = React.useState("");
  const [editor, setEditor] = React.useState("");
  const [cleanup, setCleanup] = React.useState<CleanupState>({ kind: "idle" });
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const startWordCount = React.useRef<number>(0);

  function startCleanup(): void {
    if (!editor.trim()) return;
    setCleanup({ kind: "loading", startedAt: Date.now() });
    startWordCount.current = wordCount(editor);
    void runCleanup(editor);
  }

  async function runCleanup(text: string): Promise<void> {
    try {
      const res = await fetch("/api/ai/dictation/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ original: text }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        const msg = payload.message ?? payload.error ?? `Cleanup failed (${res.status})`;
        setCleanup({ kind: "error", message: msg });
        return;
      }
      const body = (await res.json()) as CleanupResponse;
      const perChange = body.diff
        .filter((op) => op.op !== "unchanged")
        .map(() => true);
      setCleanup({ kind: "ok", response: body, perChange });
    } catch (err) {
      setCleanup({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't reach the assistant.",
      });
    }
  }

  function acceptAll(): void {
    if (cleanup.kind !== "ok") return;
    setEditor(cleanup.response.cleaned);
    setOriginal(cleanup.response.cleaned);
    setCleanup({ kind: "idle" });
  }

  function rejectAll(): void {
    if (cleanup.kind !== "ok") return;
    setCleanup({ kind: "idle" });
  }

  function toggleChange(idx: number): void {
    if (cleanup.kind !== "ok") return;
    const next = [...cleanup.perChange];
    next[idx] = !next[idx];
    setCleanup({ ...cleanup, perChange: next });
  }

  function applySelected(): void {
    if (cleanup.kind !== "ok") return;
    const changeIdxByCounter = { value: 0 };
    const parts: string[] = [];
    for (const op of cleanup.response.diff) {
      if (op.op === "unchanged") {
        parts.push(op.text);
      } else {
        const idx = changeIdxByCounter.value;
        const accepted = cleanup.perChange[idx] ?? true;
        changeIdxByCounter.value++;
        if (op.op === "added" && accepted) parts.push(op.text);
      }
    }
    const merged = parts.join("");
    setEditor(merged);
    setOriginal(merged);
    setCleanup({ kind: "idle" });
  }

  return (
    <div className="min-h-dvh">
      <AppHeader section="Dictation">
        <ThemeSwitcher />
      </AppHeader>

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        {/* Phase F (F.2) v2 page header pattern. */}
        <header className="flex flex-col gap-2">
          <Eyebrow as="p">Dictation</Eyebrow>
          <h1 className="mt-1 text-[clamp(34px,8vw,52px)] font-extrabold leading-[1] tracking-[-0.035em]">
            Voice typing
          </h1>
          <p className="mt-3 text-[17px] font-medium leading-snug text-ink-muted sm:text-[18px]">
            Talk, then review the cleanup. We show every change — nothing rewritten in silence.
          </p>
        </header>

        <section
          aria-label="Dictation editor"
          className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VoiceInput
              onTranscript={(text) => setEditor((prev) => (prev ? prev + " " + text : text))}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={startCleanup}
              disabled={!editor.trim() || cleanup.kind === "loading"}
              loading={cleanup.kind === "loading"}
            >
              {cleanup.kind === "loading" ? "Cleaning up…" : "Clean up grammar"}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <span className="tabular">
              {wordCount(editor)} {wordCount(editor) === 1 ? "word" : "words"}
            </span>
            <span className="tabular">
              ~{Math.max(1, Math.round(readingTimeSeconds(editor) / 60))} min read
            </span>
          </div>

          <EditorWithLineNumbers
            value={editor}
            onChange={setEditor}
            textareaRef={editorRef}
            ariaLabel="Dictation transcript"
          />

          {cleanup.kind === "error" ? (
            <p role="alert" className="text-sm text-danger">
              {cleanup.message}
            </p>
          ) : null}
        </section>

        {cleanup.kind === "ok" ? (
          <DiffPanel
            response={cleanup.response}
            perChange={cleanup.perChange}
            onAcceptAll={acceptAll}
            onRejectAll={rejectAll}
            onToggleChange={toggleChange}
            onApplySelected={applySelected}
          />
        ) : null}

        <footer className="text-xs leading-5 text-ink-faint">
          Tip: this draft lives only in your browser. Use the player to read it aloud when you&apos;re ready, or paste it into a document via the{" "}
          <Link
            href="/library"
            className="font-medium text-coral-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
          >
            library
          </Link>
          .
        </footer>
      </main>
    </div>
  );
}

function EditorWithLineNumbers({
  value,
  onChange,
  textareaRef,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  ariaLabel: string;
}): React.JSX.Element {
  const lines = React.useMemo(() => lineNumberedPreview(value), [value]);
  return (
    <div className="grid grid-cols-[3rem_1fr] overflow-hidden rounded-md border border-border bg-card transition-colors focus-within:border-coral-bg focus-within:shadow-focus">
      <div
        aria-hidden
        className="select-none border-r border-border py-3 text-right font-mono text-xs leading-7 text-ink-faint"
      >
        {lines.map((l) => (
          <div key={l.lineNo} className="tabular px-2">
            {l.lineNo}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tap the mic, then start talking. Your transcript appears here, live."
        spellCheck
        rows={Math.max(8, Math.min(20, lines.length))}
        className={cn(
          "w-full resize-y bg-card px-4 py-3 text-base leading-7 text-ink",
          "placeholder:text-ink-faint focus-visible:outline-none",
        )}
      />
    </div>
  );
}

function DiffPanel({
  response,
  perChange,
  onAcceptAll,
  onRejectAll,
  onToggleChange,
  onApplySelected,
}: {
  response: CleanupResponse;
  perChange: boolean[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onToggleChange: (idx: number) => void;
  onApplySelected: () => void;
}): React.JSX.Element {
  const changeCount = perChange.length;
  const acceptedCount = perChange.filter(Boolean).length;
  return (
    <section
      aria-label="Cleanup diff"
      className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Suggested cleanup</h2>
        <span className="rounded-full bg-card-muted px-3 py-1 text-xs font-medium text-ink-muted">
          {changeCount} {changeCount === 1 ? "change" : "changes"} · {acceptedCount} accepted
        </span>
      </div>

      <p className="text-sm text-ink-muted">
        We only fixed grammar and removed obvious filler. Read each change — nothing was silently rewritten.
      </p>

      <div
        role="document"
        aria-label="Cleanup diff preview"
        className="rounded-md border border-border bg-canvas p-4 text-base leading-7"
      >
        {response.diff.map((op, i) => (
          <DiffSpan
            key={i}
            op={op}
            isLast={i === response.diff.length - 1}
            changeIndex={
              op.op === "unchanged"
                ? -1
                : (() => {
                    let count = 0;
                    for (let k = 0; k < i; k++) {
                      if (response.diff[k]!.op !== "unchanged") count++;
                    }
                    return count;
                  })()
            }
            perChange={perChange}
            onToggleChange={onToggleChange}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="md" onClick={onAcceptAll}>
          Accept all
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onApplySelected}>
          Apply selected
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onRejectAll}>
          Reject all
        </Button>
        <span className="w-full text-xs text-ink-muted sm:ml-auto sm:w-auto">
          Edited text goes back into the editor on apply.
        </span>
      </div>
    </section>
  );
}

function DiffSpan({
  op,
  isLast,
  changeIndex,
  perChange,
  onToggleChange,
}: {
  op: DiffOp;
  isLast: boolean;
  changeIndex: number;
  perChange: boolean[];
  onToggleChange: (idx: number) => void;
}): React.JSX.Element {
  if (op.op === "unchanged") {
    return <span>{op.text}</span>;
  }
  const accepted = perChange[changeIndex] ?? true;
  const isRemoved = op.op === "removed";
  // Mint for additions, danger for removals (DESIGN-SYSTEM §3.5 +
  // §14.2 — semantic colors only).
  return (
    <button
      type="button"
      onClick={() => onToggleChange(changeIndex)}
      aria-pressed={accepted}
      title={isRemoved ? "Removed by cleanup" : "Added by cleanup"}
      className={cn(
        "rounded-sm px-0.5 align-baseline transition-colors duration-fast",
        isRemoved
          ? "bg-danger-soft text-danger line-through hover:bg-danger/20"
          : "bg-mint-bg text-mint-text hover:bg-mint-bg/70",
        !accepted && "opacity-40",
      )}
    >
      {op.text}
      {isLast ? "" : ""}
    </button>
  );
}