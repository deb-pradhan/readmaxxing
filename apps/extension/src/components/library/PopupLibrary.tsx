/**
 * PopupLibrary — the popup's home screen.
 *
 * Shows:
 *   1. A "Read this page" button (sends a `READ_THIS_PAGE` message
 *      to the active tab via the background service worker; the
 *      content script extracts the article via `@mozilla/readability`
 *      and opens the overlay).
 *   2. The user's ContinueShelf (in-progress docs) via the BFF
 *      `/api/positions` endpoint — same data shape the web app uses.
 *   3. A small "recent docs" list (last 5 docs).
 *
 * Reuses `ContinueShelf` and `DocCard` from the shared design system
 * — UI-UX.md §11 consistency rule. The popup just chooses a smaller
 * density (5 vs 7) and a tighter card variant.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { ContinueShelf, type ShelfItem } from "@readmaxxing/ui";
import { bffFetch } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { sendReadThisPageMessage } from "@/lib/messages";

export function PopupLibrary(): React.JSX.Element {
  const { user } = useAuth();
  const [items, setItems] = React.useState<ShelfItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const res = await bffFetch("/api/positions");
        if (!res.ok) {
          if (res.status === 401) {
            setItems([]);
            setError("Sign in to see your library.");
          } else {
            throw new Error(`positions ${res.status}`);
          }
          return;
        }
        const payload = (await res.json()) as {
          positions: Array<{
            position: ShelfItem["position"];
            document: ShelfItem["document"];
            tree: ShelfItem["tree"];
          }>;
        };
        if (cancelled) return;
        const enriched: ShelfItem[] = payload.positions.slice(0, 5).map((row) => {
          const tree = row.tree;
          const wordCount = tree?.wordCount ?? 0;
          const wordOffset = Math.max(0, row.position.wordOffset);
          return {
            position: row.position,
            document: row.document,
            tree,
            percent:
              wordCount > 0 ? Math.min(100, Math.round((wordOffset / wordCount) * 100)) : 0,
            minutesLeft:
              wordCount > 0 ? Math.max(0, Math.round((wordCount - wordOffset) / 155)) : 0,
          };
        });
        setItems(enriched);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError("Can't reach ReadMaxxing — retry");
          setItems([]);
          setLoading(false);
          // Surface the underlying message in dev tools only; the user
          // sees the calm error per UI-UX.md §11.
          // eslint-disable-next-line no-console
          console.warn("PopupLibrary fetch failed", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleReadThisPage = React.useCallback(async () => {
    setReading(true);
    try {
      await sendReadThisPageMessage();
    } finally {
      // The overlay takes focus; we can close the popup.
      window.close();
    }
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={handleReadThisPage}
        disabled={reading}
        aria-label="Read the current page aloud"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-coral-bg px-4 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-60"
      >
        <span aria-hidden>♪</span>
        {reading ? "Opening…" : "Read this page"}
      </button>

      <section aria-label="Continue listening" className="flex flex-col gap-2">
        <h2 className="text-md font-semibold">Continue listening</h2>
        {!user ? (
          <p className="rounded-md border border-dashed border-border-subtle bg-card-muted p-3 text-xs text-ink-muted">
            Sign in on the web app to see your shelf here.
          </p>
        ) : loading ? (
          <p className="text-xs text-ink-muted">Loading your shelf…</p>
        ) : error ? (
          <p className="rounded-md border border-border-subtle bg-card p-3 text-xs text-ink-muted">
            {error}
          </p>
        ) : (
          <ContinueShelf
            itemsOverride={items ?? []}
            emptyStateMessage="Nothing here yet — paste anything on the web app to start listening."
          />
        )}
      </section>

      <nav aria-label="Quick links" className="flex flex-wrap gap-2">
        <Link
          to="/settings"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          Settings
        </Link>
        <Link
          to="/voice-clone"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          Voice clone
        </Link>
        <a
          href="https://readmaxxing.app/library"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          Open web app
        </a>
      </nav>
    </div>
  );
}
