"use client";

/**
 * /library — the calm library grid (DESIGN-SYSTEM §6.5 + §13).
 *
 *   - Hero element at the top: "Today: 4h 12m read" + Continue shelf.
 *   - Calm grid (≤ 7 per chunk + "Load more") of `DocCard`s.
 *   - Filter chips + Cmd/Ctrl+K command palette.
 *   - Empty state is aspirational (illustration slot + drop-zone).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button, CountPill, Eyebrow, cn } from "@readmaxxing/ui";
import { DocCard } from "@/components/library/DocCard";
import { ImportDropzone } from "@/components/library/ImportDropzone";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import {
  LIBRARY_FILTERS,
  applyLibraryFilter,
  type LibraryFilter,
  type DocumentSourceType,
} from "@/lib/documents/source";

const ContinueShelf = dynamic(
  () => import("@/components/library/ContinueShelf").then((m) => m.ContinueShelf),
  {
    ssr: false,
    loading: () => <div className="h-32 animate-pulse rounded-lg bg-card-muted" />,
  },
);

const CommandPalette = dynamic(
  () => import("@/components/shared/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

const KeyboardShortcuts = dynamic(
  () => import("@/components/shared/KeyboardShortcuts").then((m) => m.KeyboardShortcuts),
  { ssr: false },
);

interface DocumentRow {
  id: string;
  title: string;
  source: string;
  sourceType: DocumentSourceType;
  wordCount: number;
  estimatedReadTimeSeconds: number;
  addedAt: string;
  segmentTreeId: string;
}

interface RecapCardData {
  documentId: string;
  /** Title resolved lazily at render time from the current docs list,
   *  so a recap that arrived before `docs` populated still shows the
   *  real title once the docs fetch settles (Phase F final-verify fix). */
  title?: string;
  recap: string;
  generatedAt: string | null;
}

interface PositionRow {
  documentId: string;
  lastPlayedAt: string;
}

const CHUNK_SIZE = 7;

const SAMPLE = `The best interface is the one you stop noticing.

ReadMaxxing turns any text into lifelike audio and follows along with you, sentence by sentence, word by word. Paste an article, drop a chapter, point it at a webpage — and you're listening in under five seconds. No accounts first, no menus to learn, no nonsense.

That's the whole idea — the interface gets out of your way and lets the words lead.`;

export default function LibraryPage(): React.JSX.Element {
  const [docs, setDocs] = React.useState<DocumentRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<LibraryFilter>(LIBRARY_FILTERS[0]);
  const [chunk, setChunk] = React.useState(1);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  /**
   * Phase E (E.8) — recap card state. We pick the most-recently-played
   * document (the same doc that anchors the Continue shelf) and ask
   * `/api/ai/recap` for the "pick up where you left off" summary. The
   * endpoint is cached server-side so re-renders are instant; if the
   * user has no positions yet, `recap` stays `null` and the card
   * doesn't render.
   */
  const [recap, setRecap] = React.useState<RecapCardData | null>(null);
  const [recapLoading, setRecapLoading] = React.useState(false);

  /**
   * Phase E (E.10): "Try a sample" fires the import POST exactly
   * once per click. `sampleBusy` is the lock that prevents a fast
   * second click from queuing a second import while the first
   * navigation is in flight (the audit observed a double-fire in the
   * wild — most likely cause: a re-render re-bound the handler and
   * React reused the click event, OR a double-tap re-fired before
   * the route change settled).
   */
  const [sampleBusy, setSampleBusy] = React.useState(false);

  const onTrySample = React.useCallback((): void => {
    if (sampleBusy) return;
    setSampleBusy(true);
    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: "Sample — the best interface",
        text: SAMPLE,
        sourceType: "paste",
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.documentId) {
          window.location.href = `/reader/${payload.documentId}`;
          return;
        }
        setSampleBusy(false);
      })
      .catch(() => {
        setSampleBusy(false);
      });
  }, [sampleBusy]);

  // Global Cmd/Ctrl+K opens the palette, `?` opens the shortcuts sheet.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (!inField && e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/documents", { credentials: "include" });
        if (!res.ok) throw new Error(`documents ${res.status}`);
        const payload = (await res.json()) as { documents: DocumentRow[] };
        if (!cancelled) setDocs(payload.documents);
      } catch (err) {
        if (!cancelled) {
          setDocs([]);
          setLoadError(err instanceof Error ? err.message : "Couldn't load documents.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Phase E (E.8): fetch the recap card. Steps:
   *   1. `/api/positions` — find the most-recently-played document.
   *   2. `/api/ai/recap?documentId=…` — get the cached summary.
   *   3. Resolve the title from the docs list (rendered above).
   * If any step 4xxs, fail closed — no recap card mounts. The card
   * stays hidden while loading (avoids layout shift on first paint).
   */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRecapLoading(true);
        const posRes = await fetch("/api/positions", { credentials: "include" });
        if (!posRes.ok) return;
        const posBody = (await posRes.json()) as { positions: Array<{ position: PositionRow }> };
        const sorted = (posBody.positions ?? [])
          .map((p) => p.position)
          .filter((p) => typeof p.documentId === "string" && typeof p.lastPlayedAt === "string")
          .sort(
            (a, b) =>
              new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
          );
        const top = sorted[0];
        if (!top) return;
        const recapRes = await fetch(
          `/api/ai/recap?documentId=${encodeURIComponent(top.documentId)}`,
          { credentials: "include" },
        );
        if (!recapRes.ok) return;
        const recapBody = (await recapRes.json()) as {
          recap: string | null;
          generatedAt: string | null;
        };
        if (!recapBody.recap) return;
        if (cancelled) return;
        // Title resolved at render time below so a race between the
        // positions fetch and the docs fetch doesn't strand us on a
        // generic fallback.
        setRecap({
          documentId: top.documentId,
          recap: recapBody.recap,
          generatedAt: recapBody.generatedAt,
        });
      } catch {
        /* recap card is non-essential — fail closed silently */
      } finally {
        if (!cancelled) setRecapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docs]);

  const filtered = React.useMemo(() => {
    if (!docs) return [];
    // Phase D P1 (D.3): filter chip → sourceType via DOCUMENT_SOURCE_LABELS
    // map. Previously this was a fragile lowercase string compare that
    // silently dropped the Pasted chip ("pasted" ≠ "paste").
    return applyLibraryFilter(docs, filter);
  }, [docs, filter]);

  /**
   * Phase F (F.3): per-filter counts drive the `<CountPill>` on each
   * filter chip. We compute the count for every chip up-front so
   * clicking a chip never has to recompute. The "All" count is the
   * total doc count; everything else delegates to `applyLibraryFilter`
   * (single source of truth — no parallel classification).
   */
  const filterCounts = React.useMemo(() => {
    const out: Record<string, number> = {};
    if (!docs) return out;
    for (const f of LIBRARY_FILTERS) {
      out[f.label] = applyLibraryFilter(docs, f).length;
    }
    return out;
  }, [docs]);

  const visible = filtered.slice(0, chunk * CHUNK_SIZE);
  const more = filtered.length > visible.length;

  const paletteActions = (docs ?? []).map((d) => ({
    id: d.id,
    label: d.title,
    hint: d.sourceType,
    perform: () => {
      window.location.href = `/reader/${d.id}`;
    },
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      {/* Top bar */}
      <header className="sticky top-0 z-sticky -mx-4 flex items-center justify-between gap-3 border-b border-border-subtle bg-canvas/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Link href="/library" className="text-base font-bold tracking-tight text-ink">
          ReadMaxxing
        </Link>
        <div className="flex items-center gap-1.5">
          <IconButton label="Search documents (⌘K)" onClick={() => setPaletteOpen(true)}>
            <SearchIcon />
          </IconButton>
          <IconButton label="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)}>
            <HelpIcon />
          </IconButton>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Heading — Phase F (F.2) v2 page header pattern. Eyebrow +
          Display-1 + Subtitle in that order. The eyebrow sits above
          the title at 11–12px / weight 600 / +0.08em tracking;
          Display-1 is the fluid clamp(34,8vw,52) / weight 800;
          subtitle is the secondary text color at 17–18px / weight 500. */}
      <header className="pt-8 sm:pt-12">
        <Eyebrow as="p">Library</Eyebrow>
        <h1 className="mt-2 text-[clamp(34px,8vw,52px)] font-extrabold leading-[1] tracking-[-0.035em]">
          Your library
        </h1>
        <p className="mt-3 text-[17px] font-medium leading-snug text-ink-muted sm:text-[18px]">
          Paste, drop, or link anything — start listening in seconds.
        </p>
      </header>

      {/* Phase E (E.8): recap card. Sits above Continue shelf so
          returning users see "you were here" before the doc grid. The
          endpoint is server-side cached, so the first paint is fast;
          if no position exists, the card is not rendered (no empty
          state to lie about). Title is resolved from the docs list
          at render time so it stays in sync even if the recap fetch
          resolved before the docs fetch did. */}
      {recap ? (
        <RecapCard
          recap={{
            ...recap,
            title: docs?.find((d) => d.id === recap.documentId)?.title,
          }}
        />
      ) : null}

      {/* Continue listening — sits ABOVE the importer so returning users
          land on their in-progress docs immediately (Phase D P1 D.3). The
          shelf itself sorts by lastPlayedAt desc — see ContinueShelf.tsx. */}
      <section aria-label="Continue listening" className="mt-8">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Continue listening</h2>
        <ContinueShelf />
      </section>

      {/* Importer — the primary action, always open (D32) */}
      <section aria-label="Add a document" className="mt-12">
        <ImportDropzone />
        <button
          type="button"
          onClick={onTrySample}
          disabled={sampleBusy}
          aria-busy={sampleBusy}
          className="mt-3 text-sm font-medium text-coral-text transition-opacity hover:underline focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-progress disabled:opacity-60"
        >
          {sampleBusy ? "Loading sample…" : "Or try a sample →"}
        </button>
      </section>

      {/* Documents */}
      <section aria-label="Documents" className="mt-12">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your documents</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0 sm:pb-0">
            {LIBRARY_FILTERS.map((f) => {
              const active = f === filter;
              const count = filterCounts[f.label] ?? 0;
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    setFilter(f);
                    setChunk(1);
                  }}
                  aria-pressed={active}
                  data-filter-label={f.label}
                  data-filter-count={count}
                  className={cn(
                    // Phase D P1 (D.11): ≥44px touch target. py-2 + min-h-11
                    // meets WCAG / Apple HIG while keeping the visual chip
                    // compact at 32px.
                    "shrink-0 min-h-11 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    // Phase F (F.6): peach row — `--coral-100` bg +
                    // `--coral-700` text. The non-active chips keep the
                    // previous neutral card style.
                    active
                      ? "bg-coral-100 text-coral-700"
                      : "border border-border bg-card text-ink-muted hover:bg-card-muted",
                  )}
                >
                  <span>{f.label}</span>
                  {/* Phase F (F.3): mono numeral + 0.55em superscript
                      count badge. The CountPill is aria-hidden because
                      the chip itself announces the filter label and
                      the data-filter-count attribute exposes the count
                      to programmatic readers if needed. */}
                  <CountPill
                    count={count}
                    aria-hidden
                    tone={active ? "accent" : "neutral"}
                    className="ml-1.5 align-baseline"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {loadError ? (
          <p className="mb-4 text-sm text-danger">Couldn&apos;t load documents: {loadError}</p>
        ) : null}

        {docs === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-card-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="text-base font-semibold text-ink">No documents yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Paste text, drop a PDF, or paste a link above — or try a sample to feel the flow.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((doc) => (
                <DocCard
                  key={doc.id}
                  id={doc.id}
                  title={doc.title}
                  source={doc.source}
                  sourceType={doc.sourceType}
                  wordCount={doc.wordCount}
                  readTimeSeconds={doc.estimatedReadTimeSeconds}
                />
              ))}
            </div>
            {more ? (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setChunk((c) => c + 1)}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={paletteActions}
      />
      <KeyboardShortcuts open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

/**
 * Phase E (E.8): the recap card. Title + 1-line summary + "Open recap"
 * CTA. Real content only — `recap` is a non-empty string sourced from
 * the server (or the card doesn't render).
 */
function RecapCard({ recap }: { recap: RecapCardData }): React.JSX.Element {
  return (
    <section
      aria-label="Pick up where you left off"
      className="mt-8 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6"
    >
      <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
        Pick up where you left off
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">
        {recap.title ?? "Your document"}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-ink">{recap.recap}</p>
      <div className="mt-4 flex justify-end">
        <Link
          href={`/reader/${recap.documentId}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-coral-bg px-5 text-sm font-medium text-white transition hover:bg-coral-700 focus-visible:outline-none focus-visible:shadow-focus"
        >
          Open recap →
        </Link>
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // Phase D P1 (D.11): ≥44px touch target. Was 40×40.
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-ink-muted transition-colors hover:bg-card-muted hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
    >
      {children}
    </button>
  );
}

function SearchIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HelpIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3 1-1.3 1.8v.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}