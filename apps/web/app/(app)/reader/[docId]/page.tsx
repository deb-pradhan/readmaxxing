import { Card } from "@readmaxxing/ui";
import { ReaderColumn } from "@/components/reader/ReaderColumn";

/**
 * Reader — Phase 2 entry point.
 *
 * Per UI-UX.md §5 ("The Reader Surface") + §4 ("The Player"): the page
 * hosts the `ReaderColumn` (paragraphs + karaoke highlighting) above the
 * `Player` (always-visible Play/Pause + scrubber + time; everything else
 * behind a menu). Resume-to-exact-word comes from `PlaybackPosition`
 * (Postgres) merged with IndexedDB and the SSE position stream.
 *
 * Phase 1 is a placeholder shell that imports the `ReaderColumn` stub so
 * the file graph is wired and the next agent can fill in the segment tree
 * loader + player + karaoke.
 */

interface ReaderPageProps {
  params: Promise<{ docId: string }>;
}

export default async function ReaderPage({
  params,
}: ReaderPageProps): Promise<React.JSX.Element> {
  const { docId } = await params;

  return (
    <main className="mx-auto max-w-reading px-4 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          Phase 2 · Reader Core
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-snug">
          Reader
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          Document <code className="font-mono text-sm">{docId}</code> · Phase 2
          will load the segment tree, resume at the exact word, and stream
          audio with karaoke highlighting.
        </p>
      </header>

      <ReaderColumn documentId={docId} />

      <Card padding="lg" className="mt-8">
        <p className="text-sm text-ink-muted">
          The Player primitive, KaraokeHighlighter, and audio + speech-mark
          pipeline ship in Phase 2. For now this page just wires the route
          group so the next agent has a clear home for the reader surface.
        </p>
      </Card>
    </main>
  );
}