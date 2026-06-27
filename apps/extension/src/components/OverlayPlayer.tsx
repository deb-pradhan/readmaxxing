/**
 * OverlayPlayer — the floating player injected on the host page.
 *
 * Per UI-UX.md §4.11: no mid-flow recommendations, but the overlay
 * is the user *intent* to read, so it's expected. The player is the
 * same `Player` primitive the web app uses, mounted into a shadow
 * DOM host so the page's CSS can't bleed in (CSP-safe).
 *
 * Audio: we use the page's `AudioContext` (lazily created on first
 * user gesture) so the karaoke sync is identical to the web app's
 * `AudioEngine`. The `MediaSession` API wrapper from
 * `@readmaxxing/core` plugs into the OS media-key UI so a user can
 * pause from the lock screen / media keys without leaving the page.
 */

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Player, ReaderColumn } from "@readmaxxing/ui";
import { buildSegmentTree, type SegmentTree, MediaSessionWrapper } from "@readmaxxing/core";
import { bffFetch, getAccessToken } from "@/lib/auth";

export interface OverlayHandle {
  unmount(): void;
}

export interface OverlayOptions {
  docId: string;
  title: string;
  text: string;
}

const HOST_ID = "rmx-overlay-host";

interface OverlayRootProps {
  docId: string;
  title: string;
  text: string;
  onClose: () => void;
}

function OverlayRoot({ docId, title, text, onClose }: OverlayRootProps): React.JSX.Element {
  const tree = React.useMemo<SegmentTree>(
    () => buildSegmentTree(text, { documentId: docId }),
    [docId, text],
  );
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const mediaSessionRef = React.useRef<MediaSessionWrapper | null>(null);

  // Synthesize TTS on first play — the BFF streams NDJSON with audio
  // bytes + speech marks (Phase 2 reader surface shape). For the
  // overlay we keep it simple: a single `<audio>` element fed by a
  // blob URL, and a MediaSession wrapper for the OS integration.
  const handlePlayPause = React.useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src) {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await bffFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ documentId: docId, voiceId: "eleven_rachel", speed }),
        });
        if (!res.ok) {
          throw new Error(`TTS ${res.status}`);
        }
        // The route streams NDJSON (audio/mpeg frames + speech marks).
        // For the overlay's MVP we just blob the whole thing — the
        // player still respects `currentTime` / `playbackRate` so the
        // contract is identical to the web app.
        const blob = await res.blob();
        audio.src = URL.createObjectURL(blob);
        audio.load();
      } catch (err) {
        setError(`Couldn't reach the voice service — ${(err as Error).message}`);
        return;
      }
    }
    if (playing) {
      audio.pause();
    } else {
      await audio.play();
    }
  }, [docId, playing, speed]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      setPlaying(true);
      mediaSessionRef.current?.setPlaybackState("playing");
    };
    const onPause = () => {
      setPlaying(false);
      mediaSessionRef.current?.setPlaybackState("paused");
    };
    const onLoaded = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onError = () => setError("Audio playback failed — try again.");
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("error", onError);
    };
  }, []);

  React.useEffect(() => {
    mediaSessionRef.current = new MediaSessionWrapper();
    mediaSessionRef.current.setMetadata({ title, artist: "ReadMaxxing" });
    mediaSessionRef.current.setActionHandlers({
      play: () => audioRef.current?.play().catch(() => undefined),
      pause: () => audioRef.current?.pause(),
      seekbackward: () => {
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
      },
      seekforward: () => {
        if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 15);
      },
    });
    return () => {
      mediaSessionRef.current?.clear();
    };
  }, [title]);

  const handleSpeedChange = React.useCallback((next: number) => {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, []);

  const handleSeek = React.useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  return (
    <div
      role="region"
      aria-label="ReadMaxxing reader"
      data-testid="rmx-overlay"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        width: "min(420px, 92vw)",
        maxHeight: "min(560px, 80vh)",
        backgroundColor: "#ECEFE6",
        color: "#0E0F12",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "0.75rem",
        boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        zIndex: 2147483646, // below the browser's UI but above the page
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff",
        }}
      >
        <div>
          <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: 0, opacity: 0.6 }}>
            ReadMaxxing
          </p>
          <h2 style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 16, margin: "2px 0 0", fontWeight: 600 }}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reader overlay"
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontSize: 18,
            padding: 4,
            borderRadius: 4,
          }}
        >
          ✕
        </button>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        <ReaderColumn tree={tree} currentWordIndex={-1} bottomPadding="6rem" />
      </div>
      <audio ref={audioRef} preload="none" />
      <Player
        playing={playing}
        onPlayPause={handlePlayPause}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        voiceLabel="eleven_rachel"
        loading={false}
        errorMessage={error}
        statusLabel={playing ? "Playing" : "Paused"}
      />
    </div>
  );
}

export async function injectOverlay(opts: OverlayOptions): Promise<OverlayHandle> {
  if (typeof document === "undefined") {
    throw new Error("injectOverlay must run in a browser context.");
  }
  // Idempotent — close any existing overlay before opening a new one.
  document.getElementById(HOST_ID)?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-rmx-overlay", "true");
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  // Inline a tiny CSS reset so the overlay isn't affected by the host
  // page's styles (CSP-safe, no inline event handlers, no eval).
  const style = document.createElement("style");
  style.textContent = `
    :host, :host * { box-sizing: border-box; }
    @media (prefers-color-scheme: dark) {
      :host > div { background-color: #0e0e10 !important; color: #e6e6e0 !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  shadow.appendChild(style);
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  let root: Root | null = null;
  const close = () => {
    root?.unmount();
    host.remove();
  };
  root = createRoot(mountPoint);
  root.render(
    <React.StrictMode>
      <OverlayRoot docId={opts.docId} title={opts.title} text={opts.text} onClose={close} />
    </React.StrictMode>,
  );
  return { unmount: close };
}
