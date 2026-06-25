/**
 * ContinueShelf — Phase 2 stub.
 *
 * Per UI-UX.md §6 ("Library") this is the single most-used surface: it shows
 * cover, title, progress bar, and time-left for in-progress docs, and
 * resumes at the exact word on tap.
 *
 * Phase 2 wiring:
 *   - Read `PlaybackPosition[]` for the authenticated user (TanStack Query
 *     against `/api/library/continue`, backed by IndexedDB for offline).
 *   - Render in a horizontally-scrolling shelf (Miller: ≤ 7 visible at once).
 *   - Tap → `router.push("/reader/[docId]")` which loads the segment tree
 *     and the resume offset from IndexedDB → falls back to Postgres → SSE.
 *   - Cover is the doc's first sentence rendered in the serif face as a
 *     "cover plate" (no images stored).
 *
 * Component contract intentionally returns `null` in Phase 1 so the page
 * compiles without dragging in the full player/IndexedDB surface area.
 */

export function ContinueShelf(): React.JSX.Element | null {
  // TODO(phase-2): render the resume shelf from `PlaybackPosition[]`.
  return null;
}