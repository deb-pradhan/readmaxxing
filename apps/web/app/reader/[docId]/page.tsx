"use client";

/**
 * Reader page — ReadMaxxing M-Chef design system.
 *
 * Per DESIGN-SYSTEM §4 (Player) + §5 (Reader Surface):
 *   - 66ch reading column.
 *   - Inter is the only family (no serif).
 *   - Body 15px, line-height 1.5.
 *   - Coral sentence tint + coral word fill for karaoke.
 *   - Fixed bottom player bar.
 *   - The light-mode canvas is the M-Chef neutral #ECEFE6 (see
 *     DESIGN-SYSTEM §3 tokens).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { SegmentTree, SpeechMark } from "@readmaxxing/core";
import { MediaSessionWrapper } from "@readmaxxing/core";
import { Button } from "@readmaxxing/ui";
import { DEFAULT_ELEVENLABS_VOICE_ID } from "@readmaxxing/tts";
import { PlayerBar } from "@/components/player/PlayerBar";
import { ReaderColumn } from "@/components/reader/ReaderColumn";
import { ProgressRail } from "@/components/reader/ProgressRail";
import { ReadingRuler } from "@/components/reader/ReadingRuler";
import { SelectionMenu } from "@/components/reader/SelectionMenu";
import { SummaryPanel } from "@/components/ai/SummaryPanel";
import { QuizCard } from "@/components/ai/QuizCard";
import { AskChat } from "@/components/ai/AskChat";
import { Coachmarks } from "@/components/onboarding/Coachmarks";
import { usePlayerStore } from "@/stores/player-store";
import { clientSynthesize } from "@/lib/tts/client";
import { makePosition, WORDS_PER_MINUTE } from "@readmaxxing/core";

const KeyboardShortcuts = dynamic(
  () => import("@/components/shared/KeyboardShortcuts").then((m) => m.KeyboardShortcuts),
  { ssr: false },
);

const DEFAULT_VOICE_ID = DEFAULT_ELEVENLABS_VOICE_ID;
const SEEK_STEP = 15;
const SEEK_BIG = 30;

function findActiveSentenceByWord(
  tree: SegmentTree,
  activeWordIndex: number,
): { paragraphIndex: number; sentenceIndex: number } | null {
  if (!tree.paragraphs.length || activeWordIndex < 0) return null;
  let global = 0;
  for (let p = 0; p < tree.paragraphs.length; p++) {
    const para = tree.paragraphs[p]!;
    for (let s = 0; s < para.sentences.length; s++) {
      const sent = para.sentences[s]!;
      const nextGlobal = global + sent.words.length;
      if (activeWordIndex < nextGlobal) {
        return { paragraphIndex: p, sentenceIndex: s };
      }
      global = nextGlobal;
    }
  }
  const lastPara = tree.paragraphs[tree.paragraphs.length - 1]!;
  const lastSentIdx = Math.max(0, lastPara.sentences.length - 1);
  return { paragraphIndex: tree.paragraphs.length - 1, sentenceIndex: lastSentIdx };
}

function nextNonFillerStartTime(
  paragraphIndex: number,
  sentenceIndex: number,
  fillerSet: Set<number>,
  sentenceAnchors: Array<{ p: number; s: number; start: number; end: number }>,
  audioDuration: number,
  totalChars: number,
): number | null {
  for (const entry of sentenceAnchors) {
    if (
      (entry.p > paragraphIndex || (entry.p === paragraphIndex && entry.s > sentenceIndex)) &&
      !fillerSet.has(entry.p * 1000 + entry.s)
    ) {
      if (totalChars <= 0) return null;
      return Math.max(0, (entry.start / totalChars) * (audioDuration || 0));
    }
  }
  return null;
}

/** Compact reader toolbar toggle — coral when active, consistent 40px target. */
function ReaderToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={
        // Phase D P1 (D.11): ≥44px touch target. Was 40×40.
        "inline-flex h-11 w-11 items-center justify-center rounded-md border transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:shadow-focus " +
        (active
          ? "border-coral-bg bg-coral-bg text-white"
          : "border-border bg-card text-ink-muted hover:bg-card-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

export default function ReaderPage(): React.JSX.Element {
  const params = useParams<{ docId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const docId = params.docId;
  const voiceFromQuery = search.get("voice") ?? DEFAULT_VOICE_ID;

  const [tree, setTree] = React.useState<SegmentTree | null>(null);
  const [title, setTitle] = React.useState<string>("Loading…");
  const [resumeWordOffset, setResumeWordOffset] = React.useState(0);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [marks, setMarks] = React.useState<SpeechMark[]>([]);
  const [audioRef, setAudioRef] = React.useState<HTMLAudioElement | null>(null);
  // Phase D P1 (D.1): MediaSession wire. The wrapper is feature-checked
  // (it's a no-op when `navigator.mediaSession` is absent), so we always
  // instantiate it. We use a ref so the same instance lives across renders.
  const mediaSessionRef = React.useRef<MediaSessionWrapper | null>(null);
  if (mediaSessionRef.current === null) {
    mediaSessionRef.current = new MediaSessionWrapper();
  }
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [selectionRect, setSelectionRect] = React.useState<DOMRect | null>(null);
  const [selectionText, setSelectionText] = React.useState<string>("");
  const [lineGuide, setLineGuide] = React.useState(false);
  const [fillerSegments, setFillerSegments] = React.useState<Set<number>>(new Set());
  const [aiSurface, setAiSurface] = React.useState<null | "summary" | "quiz" | "ask">(null);
  const [synthElapsed, setSynthElapsed] = React.useState(0);

  const playing = usePlayerStore((s) => s.playing);
  const speed = usePlayerStore((s) => s.speed);
  const focusMode = usePlayerStore((s) => s.focusMode);
  const bionicReading = usePlayerStore((s) => s.bionicReading);
  const currentWordIndex = usePlayerStore((s) => s.currentWordIndex);
  const setWord = usePlayerStore((s) => s.setWord);
  const setSentence = usePlayerStore((s) => s.setSentence);
  const togglePlay = usePlayerStore((s) => s.toggle);
  const pausePlayback = usePlayerStore((s) => s.pause);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const seek = usePlayerStore((s) => s.seek);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setStatus = usePlayerStore((s) => s.setStatus);
  const setLoading = usePlayerStore((s) => s.setLoading);
  const loading = usePlayerStore((s) => s.loading);
  const setPlayerError = usePlayerStore((s) => s.setError);
  const toggleFocusMode = usePlayerStore((s) => s.toggleFocusMode);
  const toggleBionic = usePlayerStore((s) => s.toggleBionic);
  const skipFillerEnabled = usePlayerStore((s) => s.skipFillerEnabled);
  const toggleSkipFiller = usePlayerStore((s) => s.toggleSkipFiller);
  const recordFillerSkip = usePlayerStore((s) => s.recordFillerSkip);

  // Map a global word index → the audio time of that word. `marks` mixes word
  // and sentence marks (sorted by time), so it must NOT be indexed by a word
  // index directly. Instead we resolve the clicked word's character offset
  // from the tree and find the word-mark covering it — robust even when the
  // tokenizer and the TTS provider split words slightly differently.
  const seekTimeForWordIndex = React.useCallback(
    (wordIndex: number): number | null => {
      if (!tree) return null;
      let count = 0;
      let charOffset: number | null = null;
      outer: for (const p of tree.paragraphs) {
        for (const s of p.sentences) {
          for (const w of s.words) {
            if (count === wordIndex) {
              charOffset = w.start;
              break outer;
            }
            count++;
          }
        }
      }
      if (charOffset === null) return null;
      let best: SpeechMark | null = null;
      for (const m of marks) {
        if (m.type !== "word") continue;
        if (m.start <= charOffset && (!best || m.start > best.start)) best = m;
      }
      return best ? best.timeSeconds : null;
    },
    [tree, marks],
  );

  // Flat list of every word with its global index + char offsets (the DOM
  // contract the highlighter uses). Sorted by start offset.
  const flatWords = React.useMemo(() => {
    if (!tree) return [] as Array<{ gi: number; start: number; end: number }>;
    const out: Array<{ gi: number; start: number; end: number }> = [];
    let gi = 0;
    for (const p of tree.paragraphs)
      for (const s of p.sentences)
        for (const w of s.words) {
          out.push({ gi, start: w.start, end: w.end });
          gi++;
        }
    return out;
  }, [tree]);

  // Audio time → correct word index. `marks` interleaves word + sentence
  // marks, so we must NOT use the marks-array index as a word index. Instead
  // we resolve each word-mark to the tree word covering its char offset, then
  // play time advances through this timeline. This is what keeps the highlight
  // locked to the audio.
  const wordTimeline = React.useMemo(() => {
    if (!flatWords.length || !marks.length) {
      return [] as Array<{ t: number; wordIndex: number }>;
    }
    const wordMarks = marks
      .filter((m) => m.type === "word")
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
    const timeline: Array<{ t: number; wordIndex: number }> = [];
    for (const m of wordMarks) {
      // binary search: last flat word whose start <= mark.start
      let lo = 0;
      let hi = flatWords.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (flatWords[mid]!.start <= m.start) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      timeline.push({ t: m.timeSeconds, wordIndex: flatWords[best]!.gi });
    }
    return timeline;
  }, [flatWords, marks]);

  // Keep the active word in view — scroll only when it drifts out of the
  // comfortable middle band, so the page glides with the audio (line focus)
  // without jittering on every word.
  React.useEffect(() => {
    if (currentWordIndex < 0) return;
    const el = document.querySelector<HTMLElement>('[data-current-word="true"]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.22 || rect.bottom > vh * 0.8) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [currentWordIndex]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
          fillerSegments?: number[];
        };
        if (cancelled) return;
        setTree(doc.segmentTree);
        setTitle(doc.title);
        if (Array.isArray(doc.fillerSegments)) {
          setFillerSegments(new Set(doc.fillerSegments));
        }

        const positionsRes = await fetch(
          `/api/positions?documentId=${encodeURIComponent(doc.id)}`,
          { credentials: "include" },
        );
        if (positionsRes.ok) {
          const payload = (await positionsRes.json()) as {
            positions: Array<{ position: { documentId: string; wordOffset: number } }>;
          };
          const mine = payload.positions.find((p) => p.position.documentId === doc.id);
          if (mine) setResumeWordOffset(mine.position.wordOffset);
        }
      } catch (err) {
        if (!cancelled) setPageError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  React.useEffect(() => {
    if (!tree) return;
    let cancelled = false;
    setLoading(true);
    setStatus("loading");
    (async () => {
      try {
        const out = await clientSynthesize({
          text: tree.text,
          voiceId: voiceFromQuery,
          speed,
          documentId: docId,
        });
        if (cancelled) return;
        setAudioUrl(out.audioUrl);
        setMarks(out.marks);
        setLoading(false);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setPlayerError(err instanceof Error ? err.message : "Couldn't reach the voice service.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree?.text, voiceFromQuery, docId]);

  // Drive the actual <audio> element from the store's `playing` flag. The Play
  // button only toggles that flag — without this nothing ever calls
  // audio.play(), so the icon flips but no sound is produced.
  React.useEffect(() => {
    const audio = audioRef;
    if (!audio || !audioUrl) return;
    if (playing) {
      void audio.play().catch(() => {
        // Autoplay can reject without a user gesture; the button click is a
        // gesture so this is an edge case. Reflect reality in the store.
        pausePlayback();
      });
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [playing, audioUrl, audioRef, pausePlayback]);

  // Phase D P1 (D.1): Media Session wire. Push the track metadata to the
  // OS chrome as soon as we know the title + audio URL, then register
  // action handlers so the OS media keys (lock screen, headphones, etc.)
  // control playback. The wrapper is a no-op when `mediaSession` is
  // unavailable (Firefox desktop, jsdom, etc.).
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = mediaSessionRef.current;
    if (!ms) return;
    ms.setMetadata({
      title,
      artist: "ReadMaxxing",
      album: "Voice library",
    });
    ms.setActionHandlers({
      play: () => togglePlay(),
      pause: () => pausePlayback(),
      seekbackward: () => {
        const audio = audioRef;
        if (!audio) return;
        audio.currentTime = Math.max(0, audio.currentTime - 15);
      },
      seekforward: () => {
        const audio = audioRef;
        if (!audio || !Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(
          audio.duration,
          audio.currentTime + 15,
        );
      },
      seekto: (details) => {
        const audio = audioRef;
        if (!audio || !Number.isFinite(details.seekTime ?? NaN)) return;
        audio.currentTime = Math.max(
          0,
          Math.min(details.seekTime as number, audio.duration || Infinity),
        );
      },
    });
  }, [title, audioRef, togglePlay, pausePlayback]);

  // Phase D P1 (D.1): keep MediaSession playbackState in sync with the
  // actual <audio> element. Mirrors the existing status state so the
  // OS lock screen shows play/pause correctly.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    mediaSessionRef.current?.setPlaybackState(playing ? "playing" : "paused");
  }, [playing]);

  // Audit C2 (Phase C P0): when the user changes `speed` from the player
  // chrome, we must re-apply it to the live <audio> element. Previously the
  // rate was only set once on `loadedmetadata`, so changes were silently
  // dropped until the next reload. We also persist the change (debounced) so
  // the next visit picks up where the user left off.
  React.useEffect(() => {
    const audio = audioRef;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed, audioRef]);

  // Debounced persistence of `speed` to the user prefs endpoint. We coalesce
  // rapid up/down keystrokes into a single PATCH so we don't spam the BFF.
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      void fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultSpeed: speed }),
      }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(id);
  }, [speed]);

  // Hydrate `speed` from the persisted user preference on mount. First-time
  // users keep the default `1.0`; the server returns `defaultSpeed` from
  // `UserPreference.prefs` when one was previously saved.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/preferences", {
          credentials: "include",
        });
        if (!res.ok) return;
        const prefs = (await res.json()) as { defaultSpeed?: number };
        if (cancelled) return;
        if (typeof prefs.defaultSpeed === "number" && Number.isFinite(prefs.defaultSpeed)) {
          const clamped = Math.max(0.5, Math.min(4.5, prefs.defaultSpeed));
          if (clamped !== speed) setSpeed(clamped);
        }
      } catch {
        // Silent — first-paint defaults are fine when prefs are unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Honest elapsed-time counter while audio is being generated (UI-UX §10 —
  // no fake "2 seconds"). Resets when synthesis finishes.
  React.useEffect(() => {
    if (!loading) {
      setSynthElapsed(0);
      return;
    }
    const started = performance.now();
    const id = setInterval(
      () => setSynthElapsed(Math.round((performance.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [loading]);

  React.useEffect(() => {
    const audio = audioRef;
    if (!audio || !marks.length || resumeWordOffset <= 0) return;
    const t = seekTimeForWordIndex(resumeWordOffset);
    if (t !== null && Number.isFinite(t)) {
      audio.currentTime = t;
      setCurrentTime(t);
      setWord(resumeWordOffset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, marks.length > 0, resumeWordOffset]);

  const sentenceIndexRef = React.useRef<
    Array<{ p: number; s: number; start: number; end: number }>
  >([]);
  React.useEffect(() => {
    if (!tree) {
      sentenceIndexRef.current = [];
      return;
    }
    const out: Array<{ p: number; s: number; start: number; end: number }> = [];
    for (let p = 0; p < tree.paragraphs.length; p++) {
      const para = tree.paragraphs[p]!;
      for (let s = 0; s < para.sentences.length; s++) {
        const sent = para.sentences[s]!;
        if (sent.words.length === 0) continue;
        out.push({ p, s, start: sent.start, end: sent.end });
      }
    }
    sentenceIndexRef.current = out;
  }, [tree]);

  const fillerLookup = React.useMemo(() => {
    if (!tree || fillerSegments.size === 0) return null;
    const skipSet = new Set<number>();
    for (let p = 0; p < tree.paragraphs.length; p++) {
      const para = tree.paragraphs[p]!;
      for (let s = 0; s < para.sentences.length; s++) {
        if (fillerSegments.has(p * 1000 + s)) {
          skipSet.add(p * 1000 + s);
        }
      }
    }
    return skipSet;
  }, [tree, fillerSegments]);

  React.useEffect(() => {
    if (!audioRef || !marks.length) return;
    let raf = 0;
    let lastIdx = -1;
    let lastSentenceIdx = -1;
    const postTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    function tick() {
      const audio = audioRef;
      if (!audio) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = audio.currentTime;
      setCurrentTime(t);

      // Resolve the active WORD INDEX from the time→word timeline (not the
      // mixed marks-array index — that was the cause of the highlight drifting
      // off the audio).
      let tlIdx = -1;
      for (let i = wordTimeline.length - 1; i >= 0; i--) {
        if (wordTimeline[i]!.t <= t) {
          tlIdx = i;
          break;
        }
      }
      const idx = tlIdx >= 0 ? wordTimeline[tlIdx]!.wordIndex : -1;
      if (idx !== lastIdx && idx !== -1) {
        lastIdx = idx;
        setWord(idx);

        if (skipFillerEnabled && fillerLookup && tree) {
          const anchor = findActiveSentenceByWord(tree, idx);
          if (anchor) {
            const key = anchor.paragraphIndex * 1000 + anchor.sentenceIndex;
            if (fillerLookup.has(key)) {
              const nextStart = nextNonFillerStartTime(
                anchor.paragraphIndex,
                anchor.sentenceIndex,
                fillerLookup,
                sentenceIndexRef.current,
                audio.duration,
                tree.text.length,
              );
              if (nextStart !== null && audio.currentTime < nextStart) {
                audio.currentTime = nextStart;
                recordFillerSkip(1);
                return;
              }
            }
          }
        }
      }
      let sentenceIdx = -1;
      for (let i = marks.length - 1; i >= 0; i--) {
        if (marks[i]!.type === "sentence" && marks[i]!.timeSeconds <= t) {
          sentenceIdx = i;
          break;
        }
      }
      if (sentenceIdx !== lastSentenceIdx && sentenceIdx !== -1) {
        lastSentenceIdx = sentenceIdx;
        setSentence(sentenceIdx);
      }
      if (postTimerRef.current) clearTimeout(postTimerRef.current);
      postTimerRef.current = setTimeout(() => {
        const position = makePosition({
          userId: "self",
          documentId: docId,
          wordOffset: idx,
          speed,
        });
        void fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(position),
        }).catch(() => undefined);
      }, 500);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (postTimerRef.current) clearTimeout(postTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, wordTimeline]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const audio = audioRef;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          if (audio) audio.currentTime = Math.max(0, audio.currentTime - (e.shiftKey ? SEEK_BIG : SEEK_STEP));
          break;
        case "ArrowRight":
          if (audio)
            audio.currentTime = Math.min(
              audio.duration || 0,
              audio.currentTime + (e.shiftKey ? SEEK_BIG : SEEK_STEP),
            );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed(Math.min(4.5, speed + 0.25));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed(Math.max(0.5, speed - 0.25));
          break;
        case "j":
        case "J": {
          if (!audio) break;
          const t = audio.currentTime;
          let prevIdx = -1;
          for (let i = marks.length - 1; i >= 0; i--) {
            const m = marks[i]!;
            if (m.type === "sentence" && m.timeSeconds < t - 0.05) {
              prevIdx = i;
              break;
            }
          }
          if (prevIdx !== -1) {
            const target = marks[prevIdx]!;
            audio.currentTime = target.timeSeconds;
          }
          break;
        }
        case "k":
        case "K": {
          if (!audio) break;
          const t = audio.currentTime;
          let nextIdx = -1;
          for (let i = 0; i < marks.length; i++) {
            const m = marks[i]!;
            if (m.type === "sentence" && m.timeSeconds > t + 0.05) {
              nextIdx = i;
              break;
            }
          }
          if (nextIdx !== -1) {
            const target = marks[nextIdx]!;
            audio.currentTime = target.timeSeconds;
          }
          break;
        }
        case "r":
        case "R":
          if (audio) {
            const t = audio.currentTime;
            const sentence = marks.find(
              (m) => m.type === "sentence" && m.timeSeconds <= t && m.timeSeconds + 5 >= t,
            );
            if (sentence) audio.currentTime = sentence.timeSeconds;
          }
          break;
        case "f":
        case "F":
          toggleFocusMode();
          break;
        case "b":
        case "B":
          toggleBionic();
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "Escape":
          setHelpOpen(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, marks.length > 0, speed]);

  React.useEffect(() => {
    function onSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionRect(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length === 0) {
        setSelectionRect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      setSelectionRect(range.getBoundingClientRect());
      setSelectionText(text);
    }
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  if (pageError) {
    return (
      <main id="main" className="mx-auto w-full max-w-reading px-4 py-16">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load this reader</h1>
        <p className="mt-3 text-ink-muted">{pageError}</p>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="mt-6"
          onClick={() => router.push("/library")}
        >
          Back to library
        </Button>
      </main>
    );
  }

  if (!tree) {
    return (
      <main id="main" className="mx-auto w-full max-w-reading px-4 py-16">
        <p className="text-sm text-ink-muted">Loading document…</p>
      </main>
    );
  }

  const percent = Math.round(
    (currentWordIndex / Math.max(1, tree.wordCount)) * 100,
  );
  const minutesLeft = Math.max(
    0,
    Math.round((tree.wordCount - currentWordIndex) / WORDS_PER_MINUTE),
  );

  return (
    <main id="main" className="relative">
      <ProgressRail percent={percent} minutesLeft={minutesLeft} />
      <ReadingRuler active={lineGuide} />

      <header
        // Phase D P1 (D.4): coachmarks anchor target. The first two coachmark
        // steps ("play" + "speed") point here so the popover lines up next
        // to the actual controls instead of floating in empty space.
        data-coachmark-target="reader-toolbar"
        className="mx-auto flex w-full max-w-reading flex-col gap-3 px-4 pt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-10"
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-ink-muted">Now playing</p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ReaderToggle active={focusMode} onClick={toggleFocusMode} label="Focus mode">
            <span aria-hidden className="text-base leading-none">
              {focusMode ? "◉" : "◌"}
            </span>
          </ReaderToggle>
          <ReaderToggle active={bionicReading} onClick={toggleBionic} label="Bionic reading (B)">
            <span aria-hidden className="text-sm font-bold leading-none">
              B
            </span>
          </ReaderToggle>
          <ReaderToggle
            active={lineGuide}
            onClick={() => setLineGuide((v) => !v)}
            label="Reading guide"
          >
            <span aria-hidden className="text-base leading-none">
              ▤
            </span>
          </ReaderToggle>
          <ReaderToggle active={false} onClick={() => setHelpOpen(true)} label="Keyboard shortcuts (?)">
            <span aria-hidden className="text-sm font-semibold leading-none">
              ?
            </span>
          </ReaderToggle>
        </div>
      </header>

      <ReaderColumn
        tree={tree}
        currentWordIndex={currentWordIndex}
        bionicReading={bionicReading}
        focusMode={focusMode}
        onWordClick={(idx) => {
          const t = seekTimeForWordIndex(idx);
          if (audioRef && t !== null && Number.isFinite(t)) {
            audioRef.currentTime = t;
            setCurrentTime(t);
          }
          setWord(idx);
        }}
      />

      <audio
        ref={setAudioRef}
        src={audioUrl ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          audio.playbackRate = speed;
          setDuration(audio.duration);
        }}
        onPlay={() => {
          setStatus("playing");
          mediaSessionRef.current?.setPlaybackState("playing");
        }}
        onPause={() => {
          setStatus("paused");
          mediaSessionRef.current?.setPlaybackState("paused");
        }}
        onEnded={() => {
          pausePlayback();
          setStatus("ended");
        }}
        onError={() =>
          setPlayerError("Audio playback failed — try again.")
        }
      />

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-28 left-1/2 z-sticky flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-ink shadow-soft"
        >
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-coral-bg border-r-transparent"
          />
          <span className="tabular">
            {(() => {
              const len = tree?.text.length ?? 0;
              const parts = Math.max(1, Math.ceil(len / 9000));
              const base =
                parts > 1
                  ? `Generating audio — long document, ${parts} parts`
                  : "Generating audio";
              return synthElapsed > 0 ? `${base}… ${synthElapsed}s` : `${base}…`;
            })()}
          </span>
        </div>
      ) : null}

      <PlayerBar
        title={title}
        playing={playing}
        loading={loading}
        currentTime={Number.isFinite(audioRef?.currentTime) ? audioRef!.currentTime : 0}
        duration={Number.isFinite(audioRef?.duration) ? audioRef!.duration : 0}
        speed={speed}
        onPlayPause={togglePlay}
        onSeek={(t) => {
          // Guard against non-finite seeks (e.g. scrubbing before audio has
          // loaded, when duration is 0/NaN) — setting a non-finite
          // currentTime throws a DOMException.
          if (!Number.isFinite(t)) return;
          if (audioRef && Number.isFinite(audioRef.duration)) {
            audioRef.currentTime = Math.max(0, Math.min(t, audioRef.duration));
          }
          seek(t);
        }}
        onSpeedChange={setSpeed}
        onShowHelp={() => setHelpOpen(true)}
        voiceLabel={voiceFromQuery}
        onSkipFillers={toggleSkipFiller}
      />
      {skipFillerEnabled ? (
        <p
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-sticky -translate-x-1/2 rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral-text"
        >
          Skip filler: on ({fillerSegments.size} marked)
        </p>
      ) : null}

      <SelectionMenu
        rect={selectionRect}
        onDismiss={() => {
          setSelectionRect(null);
          window.getSelection()?.removeAllRanges();
        }}
        onListenFromHere={() => {
          const idx = marks.findIndex(
            (m) => m.type === "word" && selectionText.includes(m.text),
          );
          if (idx !== -1 && audioRef) {
            audioRef.currentTime = marks[idx]!.timeSeconds;
          }
        }}
        onSummarize={() => setAiSurface("summary")}
        onAsk={() => setAiSurface("ask")}
        onCopy={() => {
          navigator.clipboard?.writeText(selectionText).catch(() => undefined);
        }}
      />

      {aiSurface ? (
        <AiSurface
          surface={aiSurface}
          documentId={docId}
          onClose={() => setAiSurface(null)}
        />
      ) : null}

      <KeyboardShortcuts open={helpOpen} onClose={() => setHelpOpen(false)} />
      {/* Phase D P1 (D.4): mount the first-run coachmarks tour. The
          Coachmarks component self-gates on session count + lazy-mounts
          after the first scroll, so it doesn't fight the reader chrome. */}
      <Coachmarks />
    </main>
  );
}

function AiSurface({
  surface,
  documentId,
  onClose,
}: {
  surface: "summary" | "quiz" | "ask";
  documentId: string;
  onClose: () => void;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<"summary" | "quiz" | "ask">(surface);
  React.useEffect(() => {
    setTab(surface);
  }, [surface]);

  function jumpToParagraph(paragraphIndex: number): void {
    const el = document.querySelector<HTMLElement>(
      `[data-paragraph-index="${paragraphIndex}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="AI assistant"
      className="fixed inset-x-0 bottom-0 z-modal flex max-h-[70vh] flex-col border-t border-border-subtle bg-card shadow-xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2">
        <nav className="flex gap-1" role="tablist" aria-label="AI surface">
          {(["summary", "quiz", "ask"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "rounded-md bg-coral-soft px-3 py-1 text-sm text-coral-text"
                  : "rounded-md px-3 py-1 text-sm text-ink-muted hover:bg-card-muted"
              }
            >
              {t === "summary" ? "Summary" : t === "quiz" ? "Quiz" : "Ask"}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI surface"
          // Phase D P1 (D.11): ≥44px touch target. Was 36×36.
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-card-muted"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === "summary" ? (
          <SummaryPanel documentId={documentId} onJumpToParagraph={jumpToParagraph} />
        ) : null}
        {tab === "quiz" ? (
          <QuizCard documentId={documentId} onJumpToParagraph={jumpToParagraph} />
        ) : null}
        {tab === "ask" ? (
          <AskChat documentId={documentId} onJumpToParagraph={jumpToParagraph} className="h-[60vh]" />
        ) : null}
      </div>
    </div>
  );
}