"use client";

/**
 * SummaryPanel — layered AI summary (TL;DR / bullets / detailed).
 *
 * Per UI-UX.md §7: progressive disclosure, never a wall of text. Citations
 * are clickable links that scroll the reader to the paragraph (the parent
 * passes `onJumpToParagraph` so we don't own the reader state).
 *
 * Uses TanStack Query for caching so a re-mount after switching tabs hits
 * the cache (Phase 3 brief: "Uses TanStack Query for caching").
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@readmaxxing/ui";

export interface SummaryCitation {
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface SummaryContent {
  tldr: string;
  bullets: string[];
  detailed: string;
}

export interface SummaryResponse {
  id?: string;
  cached?: boolean;
  level: "tldr" | "bullets" | "detailed";
  content: SummaryContent;
  citations: SummaryCitation[];
  model: string;
  createdAt?: string;
}

export interface SummaryPanelProps {
  documentId: string;
  /** Called when a citation link is clicked. */
  onJumpToParagraph?: (paragraphIndex: number) => void;
  className?: string;
  /** Optional override for tests. */
  fetchImpl?: typeof fetch;
}

const TABS: Array<{ key: "tldr" | "bullets" | "detailed"; label: string }> = [
  { key: "tldr", label: "TL;DR" },
  { key: "bullets", label: "Key points" },
  { key: "detailed", label: "Detailed" },
];

export function SummaryPanel({
  documentId,
  onJumpToParagraph,
  className,
  fetchImpl,
}: SummaryPanelProps): React.JSX.Element {
  const [tab, setTab] = React.useState<"tldr" | "bullets" | "detailed">("tldr");
  const f = fetchImpl ?? ((...args) => fetch(...args));
  const query = useQuery<SummaryResponse>({
    queryKey: ["ai", "summary", documentId],
    queryFn: async () => {
      const res = await f("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, level: tab }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`summary_failed: ${res.status} ${text.slice(0, 120)}`);
      }
      return (await res.json()) as SummaryResponse;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  return (
    <section
      aria-label="Document summary"
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Summary</h2>
        <nav className="flex gap-1" role="tablist" aria-label="Summary depth">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors duration-fast ease-out",
                tab === t.key
                  ? "bg-coral-soft text-coral-text"
                  : "text-ink-muted hover:bg-card-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mt-4 min-h-[6rem] text-base leading-relaxed text-ink">
        {query.isLoading ? (
          <SummarySkeleton level={tab} />
        ) : query.isError ? (
          <ErrorState
            message="Couldn't load the summary — retry"
            onRetry={() => query.refetch()}
          />
        ) : query.data ? (
          <SummaryContentView
            level={tab}
            content={query.data.content}
            citations={query.data.citations}
            onJumpToParagraph={onJumpToParagraph}
          />
        ) : null}
      </div>
    </section>
  );
}

interface SummaryContentViewProps {
  level: "tldr" | "bullets" | "detailed";
  content: SummaryContent;
  citations: SummaryCitation[];
  onJumpToParagraph?: (p: number) => void;
}

function SummaryContentView({
  level,
  content,
  citations,
  onJumpToParagraph,
}: SummaryContentViewProps): React.JSX.Element {
  if (level === "tldr") {
    return (
      <p className="text-lg leading-relaxed">
        {content.tldr || <em className="text-ink-muted">No TL;DR yet.</em>}
      </p>
    );
  }
  if (level === "bullets") {
    return (
      <ul className="ml-5 list-disc space-y-2">
        {content.bullets.length === 0 ? (
          <li className="text-ink-muted">No key points yet.</li>
        ) : (
          content.bullets.map((b, i) => (
            <li key={i}>
              {b}
              {citations[i] ? (
                <CitationLink
                  index={citations[i]!.paragraphIndex}
                  onJump={onJumpToParagraph}
                />
              ) : null}
            </li>
          ))
        )}
      </ul>
    );
  }
  return (
    <p className="text-base leading-relaxed text-ink">
      {content.detailed || <em className="text-ink-muted">No detailed summary yet.</em>}
      {citations.length > 0 ? (
        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
          {citations.slice(0, 4).map((c, i) => (
            <CitationLink key={i} index={c.paragraphIndex} onJump={onJumpToParagraph} />
          ))}
        </span>
      ) : null}
    </p>
  );
}

function CitationLink({
  index,
  onJump,
}: {
  index: number;
  onJump?: (p: number) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onJump?.(index)}
      aria-label={`Jump to paragraph ${index + 1}`}
      className="ml-1 inline-flex h-5 items-center rounded-full bg-coral-soft px-1.5 text-[10px] font-medium text-accent transition-colors duration-fast ease-out hover:bg-coral-bg hover:text-white focus-visible:outline-none focus-visible:shadow-focus"
    >
      ↗ {index + 1}
    </button>
  );
}

function SummarySkeleton({ level }: { level: "tldr" | "bullets" | "detailed" }): React.JSX.Element {
  if (level === "bullets") {
    return (
      <ul className="space-y-2" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-4 w-3/4 animate-pulse rounded-sm bg-border-subtle" />
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2" aria-busy>
      <div className="h-4 w-full animate-pulse rounded-sm bg-border-subtle" />
      <div className="h-4 w-5/6 animate-pulse rounded-sm bg-border-subtle" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-border-subtle px-3 py-1 text-ink hover:bg-card-muted"
      >
        Retry
      </button>
    </div>
  );
}
