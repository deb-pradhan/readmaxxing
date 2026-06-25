"use client";

/**
 * ContinueShelf — the single most-used surface (UI-UX.md §6).
 *
 * Renders a horizontal shelf of in-progress documents with cover (the first
 * sentence rendered in serif as a "cover plate"), title, progress %, and
 * time-left. Tap → router.push to the reader page at the exact word.
 *
 * Phase 1 reads positions from `/api/positions` (the BFF) and falls back to
 * the IndexedDB cache. Phase 2 swaps the fetch for SSE for instant cross-
 * device updates.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PlaybackPosition, DocumentMeta, SegmentTree } from "@readmaxxing/core";
import { listPositions, getSegmentTree } from "@/lib/indexeddb/cache";
import { WORDS_PER_MINUTE } from "@readmaxxing/config";

export interface ContinueShelfProps {
  /** Optional explicit user id; otherwise the dev header is used. */
  userId?: string;
  /** When provided, render an empty state instead of nothing. */
  emptyStateMessage?: string;
}

interface ShelfItem {
  position: PlaybackPosition;
  document: DocumentMeta | null;
  tree: SegmentTree | null;
  percent: number;
  minutesLeft: number;
}

export function ContinueShelf({ emptyStateMessage }: ContinueShelfProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<ShelfItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/positions", { credentials: "include" });
        if (!res.ok) throw new Error(`positions ${res.status}`);
        const payload = (await res.json()) as {
          positions: Array<{
            position: PlaybackPosition;
            document: DocumentMeta | null;
            tree: SegmentTree | null;
          }>;
        };
        const localPositions = await listPositions();
        const localByKey = new Map(localPositions.map((p) => [`${p.userId}#${p.documentId}`, p]));
        const enriched: ShelfItem[] = payload.positions.map((row) => {
          const local = localByKey.get(`${row.position.userId}#${row.position.documentId}`);
          const position = local && new Date(local.updatedAt) > new Date(row.position.updatedAt)
            ? local
            : row.position;
          const tree = row.tree;
          const wordCount = tree?.wordCount ?? 0;
          const wordOffset = Math.max(0, position.wordOffset);
          const percent = wordCount > 0 ? Math.min(100, Math.round((wordOffset / wordCount) * 100)) : 0;
          const minutesLeft = wordCount > 0
            ? Math.max(0, Math.round((wordCount - wordOffset) / WORDS_PER_MINUTE))
            : 0;
          return { position, document: row.document, tree, percent, minutesLeft };
        });
        if (!cancelled) {
          setItems(enriched);
          setLoading(false);
        }
      } catch {
        // Fall back to local cache.
        const localPositions = await listPositions();
        if (!cancelled) {
          setItems(
            localPositions.map((position) => ({
              position,
              document: null,
              tree: null,
              percent: 0,
              minutesLeft: 0,
            })),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-ink-muted">
        Loading your shelf…
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm text-ink-muted">
          {emptyStateMessage ?? "Nothing here yet — paste anything on the home page to start listening."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      {items.map((item) => {
        const title = item.document?.title ?? item.tree?.title ?? "Untitled";
        const firstSentence = item.tree?.paragraphs[0]?.sentences[0]?.text ?? "";
        return (
          <button
            key={`${item.position.userId}#${item.position.documentId}`}
            type="button"
            onClick={() => router.push(`/reader/${item.position.documentId}`)}
            className="group flex w-72 shrink-0 snap-start flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 text-left transition-colors hover:border-border focus-visible:shadow-focus"
          >
            <div className="flex h-20 items-center overflow-hidden text-ellipsis">
              <span className="font-serif text-base text-ink-muted line-clamp-3">
                {firstSentence || title}
              </span>
            </div>
            <div>
              <h3 className="truncate font-serif text-lg font-semibold">{title}</h3>
              <div className="mt-2 flex items-center gap-3">
                <div className="tabular flex-1 text-xs text-ink-muted">{item.percent}%</div>
                <div className="tabular text-xs text-ink-muted">{item.minutesLeft} min left</div>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bg-accent transition-all"
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
}