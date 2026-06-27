"use client";

/**
 * /podcasts/[episodeId] — single-episode player + transcript page.
 *
 * Per DESIGN-SYSTEM §4 (Player) + §5 (Reader Surface) + §7 (AI):
 *   - Reuses the PlayerBar + audio primitive from `@readmaxxing/ui`.
 *   - The "Talk with the hosts" sheet uses the same dark-card AI
 *     pattern as the assistant page.
 */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, StatusPill, cn, type StatusPillStatus, scrollBehavior } from "@readmaxxing/ui";
import { AskChat } from "@/components/ai/AskChat";
import { PlayerBar } from "@/components/player/PlayerBar";
import { AppHeader } from "@/components/shared/AppHeader";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

interface EpisodeResponse {
  episode: {
    id: string;
    title: string;
    audioPath: string;
    durationSeconds: number;
    status: string;
    podcast: { style: string; title: string } | null;
  };
}

interface TranscriptLine {
  index: number;
  speaker: string;
  text: string;
  timeStart: number;
  timeEnd: number;
}

interface TranscriptResponse {
  id: string;
  title: string;
  durationSeconds: number;
  lineCount: number;
  lines: TranscriptLine[];
}

/**
 * Map a `PodcastEpisodeStatus` enum value to a StatusPill status.
 *
 * Phase E (E.3): the prior "still being produced" copy leaked the raw
 * enum token (`reading_doc`) and the failure branch said "Come back
 * in a few minutes." StatusPill gives a copy-stable label, and we
 * promise the email notification (D15) instead of guessing time.
 */
function episodeStatusToPill(status: string): StatusPillStatus {
  if (status === "completed") return "ready";
  if (status === "failed") return "error";
  if (status === "queued") return "queued";
  return "rendering";
}

export default function EpisodePage(): React.JSX.Element {
  const params = useParams<{ episodeId: string }>();
  const episodeId = params?.episodeId ?? "";

  const [episode, setEpisode] = React.useState<EpisodeResponse["episode"] | null>(null);
  const [transcript, setTranscript] = React.useState<TranscriptResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);

  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const transcriptRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!episodeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ai/podcasts/${episodeId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Could not load episode (${res.status}).`);
        const data = (await res.json()) as EpisodeResponse;
        if (!cancelled) setEpisode(data.episode);
        if (data.episode.status === "completed") {
          const tRes = await fetch(`/api/ai/podcasts/${episodeId}/transcript`, {
            credentials: "include",
          });
          if (tRes.ok) {
            const tData = (await tRes.json()) as TranscriptResponse;
            if (!cancelled) setTranscript(tData);
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  const audioSrc =
    episode && episode.status === "completed"
      ? `/api/ai/podcasts/${episodeId}/stream`
      : undefined;

  function onTimeUpdate(): void {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
  }

  function onLoadedMetadata(): void {
    const a = audioRef.current;
    if (!a) return;
    setDuration(a.duration);
  }

  function onPlayPause(): void {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function onSeek(time: number): void {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(time, a.duration || time));
    setCurrentTime(a.currentTime);
  }

  function onSpeedChange(next: number): void {
    setSpeed(next);
    const a = audioRef.current;
    if (a) a.playbackRate = next;
  }

  function seekToLine(line: TranscriptLine): void {
    onSeek(line.timeStart);
    const a = audioRef.current;
    if (a && a.paused) {
      void a.play();
      setPlaying(true);
    }
  }

  React.useEffect(() => {
    const root = transcriptRef.current;
    if (!root || !transcript) return;
    const elapsed = currentTime;
    let activeIdx = 0;
    for (let i = 0; i < transcript.lines.length; i++) {
      const ln = transcript.lines[i]!;
      if (ln.timeStart <= elapsed) activeIdx = i;
      else break;
    }
    const el = root.querySelector<HTMLElement>(`[data-line-index="${activeIdx}"]`);
    el?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  }, [currentTime, transcript]);

  if (loadError) {
    return (
      <div className="min-h-dvh">
        <AppHeader section="Podcast">
          <ThemeSwitcher />
        </AppHeader>
        <main id="main" className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
          <p className="text-sm text-danger">{loadError}</p>
          <Link
            href="/podcasts"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-md border border-border bg-card px-5 text-base font-medium text-ink transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
          >
            ← All podcasts
          </Link>
        </main>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-dvh">
        <AppHeader section="Podcast">
          <ThemeSwitcher />
        </AppHeader>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-card-muted" />
          <div className="mt-3 h-4 w-32 animate-pulse rounded bg-card-muted" />
          <div className="mt-8 space-y-3 rounded-lg border border-border-subtle bg-card p-5 sm:p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-card-muted" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (episode.status !== "completed") {
    const pillStatus = episodeStatusToPill(episode.status);
    return (
      <div className="min-h-dvh">
        <AppHeader section="Podcast">
          <ThemeSwitcher />
        </AppHeader>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
            {episode.podcast?.style?.replace("_", " ") ?? "podcast"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">
            {episode.title}
          </h1>
          <div className="mt-8 rounded-lg border border-border-subtle bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <StatusPill status={pillStatus} />
              <span className="text-sm font-medium text-ink">
                {pillStatus === "error"
                  ? "Couldn't finish this episode."
                  : "Producing this episode."}
              </span>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              {pillStatus === "error"
                ? "Something went wrong while generating this episode. You can try generating it again."
                : "We'll email you when this episode is ready."}
            </p>
            <Link
              href="/podcasts"
              className="mt-5 inline-flex h-12 items-center justify-center rounded-md border border-border bg-card px-5 text-base font-medium text-ink transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
            >
              ← All podcasts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const quickChips = [
    { label: "What's the main argument?", question: "Summarize the episode in 2 sentences — what's the main argument?" },
    { label: "Pull a quote", question: "Pull the most striking quote from this episode." },
    { label: "What did I miss?", question: "Catch me up — what did the hosts cover that I might've missed?" },
    { label: "Continue the show", question: "What's a thoughtful question the hosts didn't get to answer?" },
  ];

  return (
    <div className="min-h-dvh">
      <AppHeader section="Podcast">
        <ThemeSwitcher />
      </AppHeader>

      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-40 pt-8 sm:px-6 sm:pt-10">
        <Link
          href="/podcasts"
          className="inline-flex items-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          ← All podcasts
        </Link>

        <header className="mt-4">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
            {episode.podcast?.style?.replace("_", " ") ?? "podcast"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">
            {episode.title}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {formatTime(duration || episode.durationSeconds)} · Listen, follow along, and ask
            the hosts anything.
          </p>
        </header>

        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError("Audio playback failed — try again.")}
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant={chatOpen ? "secondary" : "primary"}
            size="md"
            onClick={() => setChatOpen((v) => !v)}
            aria-expanded={chatOpen}
            className="w-full sm:w-auto"
          >
            {chatOpen ? "Close chat" : "Talk with the hosts"}
          </Button>
        </div>

        {chatOpen ? (
          <section
            aria-label="Talk with the hosts"
            className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm"
          >
            <div className="h-[60vh] min-h-[400px]">
              <AskChat
                documentId={episodeId}
                endpoint={`/api/ai/podcasts/${episodeId}/chat`}
                quickChips={quickChips}
                buildBody={(question) => ({ question, stream: true })}
              />
            </div>
          </section>
        ) : null}

        <section aria-label="Transcript" className="mt-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Transcript</h2>
          <div
            ref={transcriptRef}
            className="max-h-[60vh] overflow-y-auto rounded-lg border border-border-subtle bg-card p-5 sm:p-6"
          >
            {transcript && transcript.lines.length > 0 ? (
              <ol className="space-y-1">
                {transcript.lines.map((line) => (
                  <li
                    key={line.index}
                    data-line-index={line.index}
                    className={cn(
                      "rounded-md p-3 transition-colors duration-fast ease-out",
                      isLineActive(line, currentTime)
                        ? "bg-coral-soft"
                        : "hover:bg-card-muted",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-card-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                        {line.speaker.replace("_", " ")}
                      </span>
                      <button
                        type="button"
                        onClick={() => seekToLine(line)}
                        className="tabular rounded-full px-2 py-0.5 text-xs font-medium text-coral-text transition-colors hover:underline focus-visible:outline-none focus-visible:shadow-focus"
                        aria-label={`Jump to ${formatTime(line.timeStart)}`}
                      >
                        {formatTime(line.timeStart)}
                      </button>
                    </div>
                    <p className="text-[0.95rem] leading-relaxed text-ink">{line.text}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                Transcript not available.
              </p>
            )}
          </div>
        </section>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <PlayerBar
        title={episode.title}
        playing={playing}
        currentTime={currentTime}
        duration={duration || episode.durationSeconds}
        speed={speed}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onSpeedChange={onSpeedChange}
      />
    </div>
  );
}

function isLineActive(line: TranscriptLine, elapsed: number): boolean {
  return elapsed >= line.timeStart && elapsed < line.timeEnd;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}