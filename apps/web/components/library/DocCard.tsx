"use client";

/**
 * DocCard — a single document in the library grid.
 *
 * Clean, typographic card (no empty media placeholder): a small source tag,
 * the title, compact meta (words · read time), and a thin progress bar that
 * only appears once a document has been started. One tap → the reader.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DocumentSourceType } from "@readmaxxing/core";
import { cn } from "@readmaxxing/ui";

export interface DocCardProps {
  id: string;
  title: string;
  source?: string;
  sourceType?: DocumentSourceType;
  wordCount?: number;
  readTimeSeconds?: number;
  percent?: number;
  className?: string;
}

const SOURCE_LABEL: Record<DocumentSourceType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  md: "Markdown",
  epub: "EPUB",
  txt: "Text",
  url: "Web",
  paste: "Pasted",
};

const SOURCE_TONE: Record<DocumentSourceType, string> = {
  pdf: "bg-coral-soft text-coral-text",
  docx: "bg-lavender-soft text-lavender-text",
  md: "bg-butter-soft text-butter-text",
  epub: "bg-mint-soft text-mint-text",
  txt: "bg-card-muted text-ink-muted",
  url: "bg-mint-soft text-mint-text",
  paste: "bg-lavender-soft text-lavender-text",
};

function formatReadTime(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function DocCard({
  id,
  title,
  source,
  sourceType = "paste",
  wordCount = 0,
  readTimeSeconds = 0,
  percent = 0,
  className,
}: DocCardProps): React.JSX.Element {
  const router = useRouter();
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <button
      type="button"
      onClick={() => router.push(`/reader/${id}`)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-lg border border-border-subtle bg-card p-5 text-left",
        "transition-[border-color,box-shadow,transform] duration-fast ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-soft",
        "focus-visible:outline-none focus-visible:shadow-focus",
        className,
      )}
      aria-label={`Open ${title}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            SOURCE_TONE[sourceType],
          )}
        >
          {SOURCE_LABEL[sourceType]}
        </span>
        {pct > 0 ? (
          <span className="tabular text-xs font-medium text-ink-muted">{pct}%</span>
        ) : null}
      </div>

      <h3 className="line-clamp-2 break-words text-md font-semibold leading-snug text-ink">
        {title}
      </h3>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="tabular">{wordCount.toLocaleString()} words</span>
        {readTimeSeconds > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular">{formatReadTime(readTimeSeconds)}</span>
          </>
        ) : null}
        {source && sourceType === "url" ? (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{source}</span>
          </>
        ) : null}
      </div>

      {pct > 0 ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-border-subtle">
          <div
            aria-hidden
            className="h-full rounded-full bg-coral-bg transition-[width] duration-fast ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </button>
  );
}
