"use client";

/**
 * ContinueShelf — web-app wrapper that wires the shared primitive
 * to Next.js routing. The render path + state lives in
 * `packages/ui/src/primitives/ContinueShelf.tsx`; this file just
 * adds the BFF fetch + the `next/navigation` router.
 *
 * Reuses `apps/web/lib/indexeddb/cache.ts` for the local-first
 * position reconciliation per UI-UX.md §4.12.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DocumentMeta, PlaybackPosition, SegmentTree } from "@readmaxxing/core";
import { WORDS_PER_MINUTE } from "@readmaxxing/config";
import { listPositions } from "@/lib/indexeddb/cache";
import { ContinueShelf as ContinueShelfUI, type ShelfItem } from "@readmaxxing/ui";

const SHELF_LIMIT = 5;

export type { ShelfItem } from "@readmaxxing/ui";

interface FetchedRow {
  position: PlaybackPosition;
  document: DocumentMeta | null;
  tree: SegmentTree | null;
}

export interface ContinueShelfProps {
  itemsOverride?: ShelfItem[];
  emptyStateMessage?: string;
  className?: string;
}

export function ContinueShelf({
  itemsOverride,
  emptyStateMessage,
  className,
}: ContinueShelfProps): React.JSX.Element {
  const router = useRouter();
  const [items, setItems] = React.useState<ShelfItem[] | null>(itemsOverride ?? null);
  const [loading, setLoading] = React.useState(!itemsOverride);

  React.useEffect(() => {
    if (itemsOverride) {
      setItems(itemsOverride);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/positions", { credentials: "include" });
        if (!res.ok) throw new Error(`positions ${res.status}`);
        const payload = (await res.json()) as { positions: FetchedRow[] };
        const localPositions = await listPositions();
        const localByKey = new Map(
          localPositions.map((p) => [`${p.userId}#${p.documentId}`, p] as const),
        );
        const enriched: ShelfItem[] = payload.positions
          .map((row): ShelfItem => {
            const local = localByKey.get(`${row.position.userId}#${row.position.documentId}`);
            const position =
              local && new Date(local.updatedAt).getTime() > new Date(row.position.updatedAt).getTime()
                ? local
                : row.position;
            const tree = row.tree;
            const wordCount = tree?.wordCount ?? 0;
            const wordOffset = Math.max(0, position.wordOffset);
            const percent =
              wordCount > 0 ? Math.min(100, Math.round((wordOffset / wordCount) * 100)) : 0;
            const minutesLeft =
              wordCount > 0 ? Math.max(0, Math.round((wordCount - wordOffset) / WORDS_PER_MINUTE)) : 0;
            return { position, document: row.document, tree, percent, minutesLeft };
          })
          .sort((a, b) => {
            const at = new Date(a.position.lastPlayedAt).getTime();
            const bt = new Date(b.position.lastPlayedAt).getTime();
            return bt - at;
          })
          .slice(0, SHELF_LIMIT);
        if (!cancelled) {
          setItems(enriched);
          setLoading(false);
        }
      } catch {
        const localPositions = await listPositions();
        if (!cancelled) {
          setItems(
            localPositions.slice(0, SHELF_LIMIT).map((position) => ({
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
  }, [itemsOverride]);

  return (
    <ContinueShelfUI
      itemsOverride={loading ? undefined : (items ?? [])}
      emptyStateMessage={emptyStateMessage}
      className={className}
      onItemClick={(item) => router.push(`/reader/${item.position.documentId}`)}
    />
  );
}
