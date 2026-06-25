import { Card } from "@readmaxxing/ui";
import { ContinueShelf } from "@/components/library/ContinueShelf";

/**
 * Library — Phase 2 entry point.
 *
 * Per UI-UX.md §6 ("Library"): calm grid/list of imported docs with a
 * "Continue listening" shelf at the top. Filters-not-folders, instant
 * `Cmd/Ctrl+K` search, ≤ 7 items per chunk with "Load more" (Miller's Law).
 *
 * Phase 1 is a placeholder shell that imports the `ContinueShelf` stub so
 * the file graph is wired and the next agent can fill in data + interactions.
 */
export default function LibraryPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-reading px-4 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          Phase 2 · Reader Core
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-snug">
          Library
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          Your imported docs. Pick up where you left off.
        </p>
      </header>

      <ContinueShelf />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">All documents</h2>
        <Card padding="lg" className="mt-4">
          <p className="text-sm text-ink-muted">
            Phase 2 will render imported docs here as a calm grid (≤ 7 per
            chunk, with filters and `Cmd/Ctrl+K` search). For now, this shell
            exists so the route is wired and `ContinueShelf` has a home.
          </p>
        </Card>
      </section>
    </main>
  );
}