"use client";

/**
 * ContinueShelf — horizontal scroll shelf of in-progress documents.
 *
 * Per DESIGN-SYSTEM §13.5 (Tables) + §6.5: the most-used surface.
 * Each card shows cover (first sentence as a "cover plate"), title,
 * progress %, and time left. One tap resumes at the exact word.
 *
 * This is the shared primitive used by the web app, the Chrome
 * extension popup, and (in Phase 6+) the mobile library. The web
 * app's own ContinueShelf at `apps/web/components/library/` is a
 * thin re-export — keeping the BFF-aware networking on the app side
 * and the rendering on the primitive side.
 */

import * as React from "react";
import { cn } from "../cn";
import type { DocumentMeta, PlaybackPosition, SegmentTree } from "@readmaxxing/core";

const WORDS_PER_MINUTE = 155;

export interface ShelfItem {
  position: PlaybackPosition;
  document: DocumentMeta | null;
  tree: SegmentTree | null;
  percent: number;
  minutesLeft: number;
}

export interface ContinueShelfProps {
  itemsOverride?: ShelfItem[];
  emptyStateMessage?: string;
  className?: string;
  /** Override the click handler — defaults to navigating via `next/navigation`
   *  when the consumer mounts this inside the web app. Mobile + extension
   *  supply their own router. */
  onItemClick?: (item: ShelfItem) => void;
}

export const ContinueShelf = React.forwardRef<HTMLDivElement, ContinueShelfProps>(
  function ContinueShelf({ itemsOverride, emptyStateMessage, className, onItemClick }: ContinueShelfProps, ref) {
    const items = itemsOverride ?? null;
    if (!items) {
      return (
        <div
          ref={ref}
          className={cn("flex h-32 items-center justify-center text-sm text-ink-muted", className)}
        >
          Loading your shelf…
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-subtle bg-card-muted text-center",
            className,
          )}
        >
          <p className="text-sm text-ink-muted">
            {emptyStateMessage ?? "Nothing here yet — paste anything on the home page to start listening."}
          </p>
        </div>
      );
    }
    return (
      <div
        ref={ref}
        className={cn("flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2", className)}
        role="list"
        aria-label="Continue listening"
      >
        {items.map((item) => {
          const title = item.document?.title ?? item.tree?.title ?? "Untitled";
          const firstSentence = item.tree?.paragraphs[0]?.sentences[0]?.text ?? "";
          return (
            <button
              key={`${item.position.userId}#${item.position.documentId}`}
              type="button"
              role="listitem"
              onClick={() => {
                if (onItemClick) {
                  onItemClick(item);
                  return;
                }
                // No router wired — no-op.
                void item;
              }}
              className="group flex w-72 shrink-0 snap-start flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 text-left transition-colors duration-fast ease-out hover:border-border focus-visible:outline-none focus-visible:shadow-focus"
            >
              <div className="flex h-20 items-center overflow-hidden text-ellipsis rounded-md bg-canvas p-3">
                <span className="text-base leading-snug text-ink-muted line-clamp-3">
                  {firstSentence || title}
                </span>
              </div>
              <div>
                <h3 className="truncate text-lg font-semibold text-ink">{title}</h3>
                <div className="mt-2 flex items-center gap-3">
                  <span className="tabular text-xs text-ink-muted">{item.percent}%</span>
                  <span className="tabular text-xs text-ink-muted">
                    {item.minutesLeft} min left
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className="h-full rounded-full bg-coral-bg transition-[width] duration-fast ease-out"
                    style={{ width: `${item.percent}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  },
);