"use client";

/**
 * Reader page — UI-UX.md §5 (Reader Surface) + §4 (Player).
 *
 * The reader hydrates with:
 *   1. /api/documents/[docId] → the SegmentTree + metadata
 *   2. /api/positions?documentId=… → the resume word offset (cross-device)
 *   3. IndexedDB → last-seen position (instant first paint, offline-first)
 *
 * The Player + KaraokeHighlighter are dynamically imported so the initial
 * HTML payload is under the 50KB UI-UX.md §10 budget.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { SegmentTree } from "@readmaxxing/core";
import { getPosition, putSegmentTree } from "@/lib/indexeddb/cache";
import { ReaderColumn } from "@/components/reader/ReaderColumn";

const Player = dynamic(
  () => import("@/components/player/Player").then((m) => m.Player),
  { ssr: false },
);

const DEFAULT_VOICE_ID = "eleven_rachel";

export default function ReaderPage(): React.JSX.Element {
  const params = useParams<{ docId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const docId = params.docId;
  const voiceFromQuery = search.get("voice") ?? DEFAULT_VOICE_ID;

  const [tree, setTree] = React.useState<SegmentTree | null>(null);
  const [title, setTitle] = React.useState<string>("Loading…");
  const [resumeWordOffset, setResumeWordOffset] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState<string>(
    "Loading document…",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = React.useState(-1);

  // ------------------------------------------------------------------
  // Hydrate.
  // ------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Local cache first — instant paint.
        const docRes = await fetch(`/api/documents/${docId}`, {
          credentials: "include",
        });
        if (!docRes.ok) {
          throw new Error(
            docRes.status === 404
              ? "This document doesn't exist (it may have been on another device)."
              : `Couldn't load the document (${docRes.status}).`,
          );
        }
        const doc = (await docRes.json()) as {
          id: string;
          title: string;
          segmentTree: SegmentTree;
          segmentTreeId: string;
        };
        if (cancelled) return;
        setTree(doc.segmentTree);
        setTitle(doc.title);
        void putSegmentTree(doc.segmentTree).catch(() => undefined);

        const local = await getPosition({
          userId: "self",
          documentId: doc.id,
        }).catch(() => undefined);
        if (local) {
          setResumeWordOffset(local.wordOffset);
          return;
        }
        const positionsRes = await fetch("/api/positions", {
          credentials: "include",
        });
        if (positionsRes.ok) {
          const payload = (await positionsRes.json()) as {
            positions: Array<{ position: { documentId: string; wordOffset: number } }>;
          };
          const mine = payload.positions.find((p) => p.position.documentId === doc.id);
          if (mine) setResumeWordOffset(mine.position.wordOffset);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // ------------------------------------------------------------------
  // Render.
  // ------------------------------------------------------------------
  if (error) {
    return (
      <main className="mx-auto w-full max-w-reading px-4 py-16">
        <h1 className="font-serif text-2xl font-semibold">Couldn't load this reader</h1>
        <p className="mt-3 text-ink-muted">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-6 inline-flex h-11 items-center rounded-md bg-accent px-5 text-white focus-visible:shadow-focus"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (!tree) {
    return (
      <main className="mx-auto w-full max-w-reading px-4 py-16">
        <p className="text-sm text-ink-muted">{loadingMessage}</p>
      </main>
    );
  }

  return (
    <main className="relative">
      <header className="mx-auto w-full max-w-reading px-4 pt-8">
        <p className="text-xs uppercase tracking-widest text-ink-muted">Now playing</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">{title}</h1>
      </header>

      <ReaderColumn
        tree={tree}
        currentWordIndex={currentWordIndex}
        onWordClick={(i) => setCurrentWordIndex(i)}
      />

      <Player
        tree={tree}
        initialWordOffset={resumeWordOffset}
        voiceId={voiceFromQuery}
        userId="self"
        documentId={docId}
        onWordChange={setCurrentWordIndex}
      />
    </main>
  );
}