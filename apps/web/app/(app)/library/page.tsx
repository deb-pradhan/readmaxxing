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
import { Button, cn } from "@readmaxxing/ui";
import { DocCard } from "@/components/library/DocCard";
import { ImportDropzone } from "@/components/library/ImportDropzone";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

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
  sourceType: "pdf" | "docx" | "md" | "epub" | "txt" | "url" | "paste";
  wordCount: number;
  estimatedReadTimeSeconds: number;
  addedAt: string;
  segmentTreeId: string;
}

const CHUNK_SIZE = 7;

const FILTERS = ["All", "Pasted", "URL", "PDF", "EPUB"] as const;
type Filter = (typeof FILTERS)[number];

const SAMPLE = `The best interface is the one you stop noticing.

ReadMaxxing turns any text into lifelike audio and follows along with you, sentence by sentence, word by word. Paste an article, drop a chapter, point it at a webpage — and you're listening in under five seconds. No accounts first, no menus to learn, no nonsense.

That's the whole idea — the interface gets out of your way and lets the words lead.`;

export default function LibraryPage(): React.JSX.Element {
  const [docs, setDocs] = React.useState<DocumentRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("All");
  const [chunk, setChunk] = React.useState(1);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

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

  const filtered = React.useMemo(() => {
    if (!docs) return [];
    if (filter === "All") return docs;
    return docs.filter((d) => d.sourceType.toLowerCase() === filter.toLowerCase());
  }, [docs, filter]);

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
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
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

      {/* Heading */}
      <div className="pt-8 sm:pt-12">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Your library
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          Paste, drop, or link anything — start listening in seconds.
        </p>
      </div>

      {/* Importer — the primary action, always open (D32) */}
      <section aria-label="Add a document" className="mt-6">
        <ImportDropzone />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(SAMPLE).catch(() => undefined);
            void fetch("/api/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ title: "Sample — the best interface", text: SAMPLE, sourceType: "paste" }),
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((payload) => {
                if (payload?.documentId) window.location.href = `/reader/${payload.documentId}`;
              })
              .catch(() => undefined);
          }}
          className="mt-3 text-sm font-medium text-coral-text hover:underline focus-visible:outline-none focus-visible:shadow-focus"
        >
          Or try a sample →
        </button>
      </section>

      {/* Continue listening */}
      <section aria-label="Continue listening" className="mt-12">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Continue listening</h2>
        <ContinueShelf />
      </section>

      {/* Documents */}
      <section aria-label="Documents" className="mt-12">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your documents</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0 sm:pb-0">
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFilter(f);
                    setChunk(1);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-ink text-canvas"
                      : "border border-border bg-card text-ink-muted hover:bg-card-muted",
                  )}
                >
                  {f}
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
    </div>
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-ink-muted transition-colors hover:bg-card-muted hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
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