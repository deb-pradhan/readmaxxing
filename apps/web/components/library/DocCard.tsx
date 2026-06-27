"use client";

/**
 * DocCard — a single document in the library grid.
 *
 * Phase F (F.4): the card now opens with a deterministic gradient
 * cover (CoverArt keyed on the document id) so every doc gets its
 * own visual fingerprint. The source tag uses the shared Chip
 * primitive (DESIGN-SYSTEM §25.6). The whole card stays a single
 * <button> — one tap → the reader.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DocumentSourceType } from "@readmaxxing/core";
import { Chip, CoverArt, cn, type ChipVariant } from "@readmaxxing/ui";

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

const SOURCE_CHIP: Record<DocumentSourceType, ChipVariant> = {
  pdf: "coral",
  docx: "lavender",
  md: "butter",
  epub: "mint",
  txt: "neutral",
  url: "mint",
  paste: "lavender",
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
        "group flex w-full flex-col gap-3 overflow-hidden rounded-lg border border-border-subtle bg-card p-0 text-left",
        "transition-[border-color,box-shadow,transform] duration-fast ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-soft",
        "focus-visible:outline-none focus-visible:shadow-focus",
        className,
      )}
      aria-label={`Open ${title}`}
    >
      {/* Phase F (F.4): deterministic gradient cover keyed on the
          document id. Decorative — the title is exposed via the
          surrounding <h3>. 3:4 aspect = book cover proportions. */}
      <CoverArt
        seed={id}
        title={title}
        aspect="3/4"
        className="rounded-b-none"
      />

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Chip variant={SOURCE_CHIP[sourceType]}>{SOURCE_LABEL[sourceType]}</Chip>
          {pct > 0 ? (
            <span className="font-mono tabular-nums text-xs font-medium text-ink-muted">
              {pct}%
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 break-words text-md font-semibold leading-snug text-ink">
          {title}
        </h3>

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className="font-mono tabular-nums">{wordCount.toLocaleString()} words</span>
          {readTimeSeconds > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono tabular-nums">
                {formatReadTime(readTimeSeconds)}
              </span>
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
      </div>
    </button>
  );
}
