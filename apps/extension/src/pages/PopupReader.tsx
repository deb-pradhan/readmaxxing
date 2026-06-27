/**
 * PopupReader — minimal reader view inside the popup's small frame.
 *
 * The popup reader is intentionally limited compared to the full web
 * reader: it shows the document title, the segment tree's first 2-3
 * paragraphs, and a "Listen in overlay" button. The overlay (injected
 * by the content script) is where the real playback + karaoke live
 * because it can use the full viewport.
 *
 * Per UI-UX.md §11: we reuse `ReaderColumn` and `KaraokeHighlighter`
 * from `@readmaxxing/ui` so the typography + highlight behavior are
 * pixel-identical to the web app.
 */

import * as React from "react";
import { Link, useParams } from "react-router-dom";
import type { SegmentTree } from "@readmaxxing/core";
import { ReaderColumn, Player } from "@readmaxxing/ui";
import { bffFetch } from "@/lib/auth";
import { sendBackground } from "@/lib/messages";

interface DocumentResponse {
  id: string;
  title: string;
  segmentTree: SegmentTree;
}

export function PopupReader(): React.JSX.Element {
  const { docId } = useParams<{ docId: string }>();
  const [tree, setTree] = React.useState<SegmentTree | null>(null);
  const [title, setTitle] = React.useState<string>("Loading…");
  const [error, setError] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await bffFetch(`/api/documents/${encodeURIComponent(docId)}`);
        if (!res.ok) throw new Error(`doc ${res.status}`);
        const doc = (await res.json()) as DocumentResponse;
        if (cancelled) return;
        setTree(doc.segmentTree);
        setTitle(doc.title);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const handleOpenOverlay = React.useCallback(async () => {
    if (!docId) return;
    // Tell the background to dispatch OPEN_READER to the active tab's
    // content script, which mounts the full overlay with the same
    // player + karaoke the web app uses.
    await sendBackground({ kind: "OPEN_READER", docId });
    window.close();
  }, [docId]);

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-danger">Couldn't load this document — {error}</p>
        <Link
          to="/library"
          className="mt-3 inline-flex h-11 items-center rounded-md border border-border px-3 text-sm focus-visible:outline-none focus-visible:shadow-focus"
        >
          Back to library
        </Link>
      </div>
    );
  }
  if (!tree) {
    return (
      <div className="p-4">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-md font-semibold">{title}</h2>
      <ReaderColumn
        tree={tree}
        currentWordIndex={-1}
        bottomPadding="6rem"
        className="max-h-[60vh] overflow-y-auto rounded-md border border-border-subtle bg-card p-3"
      />
      <button
        type="button"
        onClick={handleOpenOverlay}
        className="inline-flex h-11 items-center justify-center rounded-md bg-coral-bg text-sm font-medium text-white focus-visible:outline-none focus-visible:shadow-focus"
      >
        Listen in overlay
      </button>
      <Player
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        currentTime={0}
        duration={0}
        onSeek={() => undefined}
        speed={1}
        onSpeedChange={() => undefined}
        voiceLabel="eleven_rachel"
        loading={false}
      />
    </div>
  );
}
