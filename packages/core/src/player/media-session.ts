/**
 * MediaSession — wraps the browser Media Session API for lock-screen + OS
 * media-key integration. Per UI-UX.md §4.10, listening continues when the
 * tab is hidden.
 *
 * The API is a no-op on browsers that don't support `navigator.mediaSession`
 * (Firefox desktop, etc.); tests can inject a custom session object to verify
 * the action handlers are wired correctly.
 */

export interface MediaSessionMetadataInput {
  title: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes?: string; type?: string }>;
}

export type MediaSessionAction =
  | "play"
  | "pause"
  | "seekbackward"
  | "seekforward"
  | "previoustrack"
  | "nexttrack"
  | "seekto"
  | "stop";

export interface MediaSessionActionHandlers {
  play?: () => void;
  pause?: () => void;
  seekbackward?: (details: MediaSessionActionDetails) => void;
  seekforward?: (details: MediaSessionActionDetails) => void;
  previoustrack?: () => void;
  nexttrack?: () => void;
  seekto?: (details: MediaSessionActionDetails) => void;
  stop?: () => void;
}

export interface MediaSessionActionDetails {
  action: MediaSessionAction;
  seekTime?: number;
  fastSeek?: boolean;
}

export interface MediaSessionLike {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler(
    action: MediaSessionAction,
    handler: ((details: MediaSessionActionDetails) => void) | null,
  ): void;
}

export interface MediaSessionWrapperOptions {
  /** Optional injected session (tests). */
  session?: MediaSessionLike | null;
  /** Navigator-like object exposing `.mediaSession`. */
  navigatorLike?: { mediaSession?: MediaSessionLike | null } | null;
}

const DEFAULT_SEEK_OFFSET = 15;

export class MediaSessionWrapper {
  private readonly session: MediaSessionLike | null;
  private handlers: MediaSessionActionHandlers = {};

  constructor(opts: MediaSessionWrapperOptions = {}) {
    this.session =
      opts.session ??
      (opts.navigatorLike?.mediaSession ?? null) ??
      (typeof navigator !== "undefined"
        ? (navigator as unknown as { mediaSession?: MediaSessionLike | null })
            .mediaSession ?? null
        : null);
  }

  /** Whether the host environment supports Media Session. */
  isSupported(): boolean {
    return this.session !== null;
  }

  /** Set the track metadata shown on the lock screen / OS chrome. */
  setMetadata(meta: MediaSessionMetadataInput): void {
    if (!this.session) return;
    // The browser provides `MediaMetadata`; construct via `new` so we don't
    // re-declare the global type.
    const Ctor = (globalThis as unknown as {
      MediaMetadata?: new (init: MediaSessionMetadataInput) => MediaMetadata;
    }).MediaMetadata;
    if (!Ctor) return;
    this.session.metadata = new Ctor({
      title: meta.title,
      artist: meta.artist ?? "",
      album: meta.album ?? "",
      artwork: [...(meta.artwork ?? [])],
    });
  }

  /** Update the playback state — "playing" | "paused" | "none". */
  setPlaybackState(state: "playing" | "paused" | "none"): void {
    if (!this.session) return;
    this.session.playbackState = state;
  }

  /**
   * Wire OS-media-key action handlers. Pass the subset you support; the
   * wrapper registers them and skips the rest. The wrapper also injects the
   * default `seekbackward`/`seekforward` offset (15 s) per UI-UX.md §4.7.
   */
  setActionHandlers(handlers: MediaSessionActionHandlers): void {
    if (!this.session) return;
    this.handlers = { ...handlers };
    const actions: Array<[MediaSessionAction, ((d: MediaSessionActionDetails) => void) | null]> = [
      ["play", handlers.play ? () => handlers.play?.() : null],
      ["pause", handlers.pause ? () => handlers.pause?.() : null],
      [
        "seekbackward",
        handlers.seekbackward
          ? (d) => handlers.seekbackward?.({ ...d, seekTime: d.seekTime ?? DEFAULT_SEEK_OFFSET })
          : null,
      ],
      [
        "seekforward",
        handlers.seekforward
          ? (d) => handlers.seekforward?.({ ...d, seekTime: d.seekTime ?? DEFAULT_SEEK_OFFSET })
          : null,
      ],
      [
        "previoustrack",
        handlers.previoustrack ? () => handlers.previoustrack?.() : null,
      ],
      ["nexttrack", handlers.nexttrack ? () => handlers.nexttrack?.() : null],
      [
        "seekto",
        handlers.seekto ? (d) => handlers.seekto?.(d) : null,
      ],
      ["stop", handlers.stop ? () => handlers.stop?.() : null],
    ];
    for (const [action, handler] of actions) {
      try {
        this.session.setActionHandler(action, handler);
      } catch {
        // Some browsers throw on unknown action types — swallow.
      }
    }
  }

  /** Clear all handlers (useful on teardown / doc change). */
  clear(): void {
    if (!this.session) return;
    this.handlers = {};
    this.session.metadata = null;
    this.session.playbackState = "none";
    const actions: MediaSessionAction[] = [
      "play",
      "pause",
      "seekbackward",
      "seekforward",
      "previoustrack",
      "nexttrack",
      "seekto",
      "stop",
    ];
    for (const a of actions) {
      try {
        this.session.setActionHandler(a, null);
      } catch {
        /* ignore */
      }
    }
  }

  /** Read-only inspection (tests). */
  inspectHandlers(): MediaSessionActionHandlers {
    return { ...this.handlers };
  }
}