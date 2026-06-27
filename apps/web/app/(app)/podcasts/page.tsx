"use client";

/**
 * /podcasts — discovery feed for AI-generated podcast episodes.
 *
 * Per DESIGN-SYSTEM §6.5 + §13:
 *   - Calm grid, ≤7 per chunk + Load more (Miller's Law).
 *   - Filters by style (Podcast / Late Night / Debate / Lecture).
 *   - Style cards use brand accents:
 *       Podcast  = neutral cream
 *       Late Night = butter
 *       Debate  = coral (the hero accent)
 *       Lecture = lavender
 */

import * as React from "react";
import Link from "next/link";
import { Button, cn } from "@readmaxxing/ui";
import { PodcastCreator, PODCAST_STYLES } from "@/components/ai/PodcastCreator";
import { AppHeader } from "@/components/shared/AppHeader";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

interface EpisodeRow {
  id: string;
  podcastId: string;
  title: string;
  audioPath: string;
  durationSeconds: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  podcast: {
    id: string;
    style: string;
    title: string;
  } | null;
}

interface DocumentsResponse {
  documents: Array<{ id: string; title: string }>;
}

const CHUNK = 7;

const FILTERS = [
  { key: "", label: "All" },
  { key: "podcast", label: "Podcast" },
  { key: "late_night", label: "Late Night" },
  { key: "debate", label: "Debate" },
  { key: "lecture", label: "Lecture" },
] as const;

const STYLE_ACCENT: Record<string, string> = {
  podcast: "bg-card-muted text-ink",
  late_night: "bg-butter-soft text-butter-text",
  debate: "bg-coral-soft text-coral-text",
  lecture: "bg-lavender-soft text-lavender-text",
};

export default function PodcastsPage(): React.JSX.Element {
  const [episodes, setEpisodes] = React.useState<EpisodeRow[] | null>(null);
  const [filter, setFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [docs, setDocs] = React.useState<DocumentsResponse["documents"]>([]);
  const [creatorOpen, setCreatorOpen] = React.useState(false);

  const [counts, setCounts] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("podcast-play-counts");
      if (raw) setCounts(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore — non-essential */
    }
  }, []);

  const fetchEpisodes = React.useCallback(async (): Promise<void> => {
    try {
      const url = new URL("/api/ai/podcasts", window.location.origin);
      if (filter) url.searchParams.set("style", filter);
      url.searchParams.set("page", String(page));
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`Could not load podcasts (${res.status}).`);
      const data = (await res.json()) as {
        episodes: EpisodeRow[];
        has_more: boolean;
      };
      setEpisodes((prev) => (page === 1 ? data.episodes : [...(prev ?? []), ...data.episodes]));
      setHasMore(data.has_more);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setEpisodes((prev) => prev ?? []);
    }
  }, [filter, page]);

  React.useEffect(() => {
    void fetchEpisodes();
  }, [fetchEpisodes]);

  React.useEffect(() => {
    setPage(1);
  }, [filter]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/documents", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as DocumentsResponse;
        if (!cancelled) setDocs(data.documents);
      } catch {
        /* ignore — picker just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = episodes ?? [];
  const ready = visible.filter((e) => e.status === "completed");
  const inProgress = visible.filter((e) => e.status !== "completed");

  return (
    <div className="min-h-dvh">
      <AppHeader section="Podcasts">
        <ThemeSwitcher />
      </AppHeader>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Podcasts</h1>
            <p className="mt-2 text-base text-ink-muted">
              Short audio shows generated from your documents.
            </p>
          </div>
          <Button
            type="button"
            variant={creatorOpen ? "secondary" : "primary"}
            size="md"
            onClick={() => setCreatorOpen((v) => !v)}
          >
            {creatorOpen ? "Close" : "New podcast"}
          </Button>
        </div>

        {creatorOpen ? (
          <section className="mt-8">
            <PodcastCreator documents={docs} onCreated={() => setCreatorOpen(false)} />
          </section>
        ) : null}

        <section aria-label="Filter by style" className="mt-8">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key || "all"}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-ink text-canvas"
                      : "border border-border bg-card text-ink-muted hover:bg-card-muted",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {error ? (
          <p role="alert" className="mt-6 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {episodes === null ? (
          <div className="mt-8">
            <SkeletonGrid />
          </div>
        ) : ready.length === 0 && inProgress.length === 0 ? (
          <div className="mt-8">
            <EmptyState onCreate={() => setCreatorOpen(true)} />
          </div>
        ) : (
          <>
            {inProgress.length > 0 ? (
              <section className="mt-10">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-muted">
                  Producing
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inProgress.map((ep) => (
                    <li key={ep.id}>
                      <ProducingCard episode={ep} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {ready.length > 0 ? (
              <section aria-label="Episodes" className="mt-10">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-muted">
                  Ready
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ready.map((ep) => (
                    <li key={ep.id}>
                      <EpisodeCard
                        episode={ep}
                        playCount={counts[ep.id] ?? 0}
                        onPlay={() => {
                          setCounts((prev) => {
                            const next = { ...prev, [ep.id]: (prev[ep.id] ?? 0) + 1 };
                            try {
                              localStorage.setItem(
                                "podcast-play-counts",
                                JSON.stringify(next),
                              );
                            } catch {
                              /* ignore */
                            }
                            return next;
                          });
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function EpisodeCard({
  episode,
  playCount,
  onPlay,
}: {
  episode: EpisodeRow;
  playCount: number;
  onPlay: () => void;
}): React.JSX.Element {
  const style = episode.podcast?.style ?? "podcast";
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-card p-5 transition hover:-translate-y-0.5 hover:border-border hover:shadow-soft focus-within:shadow-focus">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest",
            STYLE_ACCENT[style] ?? "bg-canvas text-ink-muted",
          )}
        >
          {style.replace("_", " ")}
        </span>
        <span className="tabular text-xs text-ink-muted">
          {Math.max(1, Math.round(episode.durationSeconds / 60))} min
        </span>
      </div>
      <h3 className="break-words text-md font-semibold leading-snug text-ink">
        {episode.title}
      </h3>
      <p className="tabular text-xs text-ink-muted">
        {playCount} {playCount === 1 ? "play" : "plays"}
      </p>
      <div className="mt-auto flex items-center gap-2">
        <Link
          href={`/podcasts/${episode.id}`}
          onClick={onPlay}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-coral-bg px-3 text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:shadow-focus"
        >
          ▶ Listen
        </Link>
        <Link
          href={`/podcasts/${episode.id}`}
          className="inline-flex h-12 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-ink-muted transition hover:bg-card-muted hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
        >
          Transcript
        </Link>
      </div>
    </article>
  );
}

function ProducingCard({ episode }: { episode: EpisodeRow }): React.JSX.Element {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-5">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-ink-muted">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral-bg" />
        Producing
      </span>
      <h3 className="break-words text-md font-semibold leading-snug text-ink">{episode.title}</h3>
      <p className="tabular text-xs text-ink-muted">
        Status: <strong className="font-semibold text-ink">{episode.status}</strong>
      </p>
      <Link
        href={`/podcasts/${episode.id}`}
        className="mt-auto inline-flex h-12 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-ink-muted transition hover:bg-card-muted hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
      >
        View progress →
      </Link>
    </article>
  );
}

function SkeletonGrid(): React.JSX.Element {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="h-44 animate-pulse rounded-lg bg-card-muted"
          aria-hidden
        />
      ))}
    </ul>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">Create your first podcast</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Pick a doc, choose a style, and we&apos;ll turn it into a short audio show.
      </p>
      <div className="mt-6 flex justify-center">
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          New podcast
        </Button>
      </div>
    </div>
  );
}