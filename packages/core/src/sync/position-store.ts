/**
 * Position store — IndexedDB-backed playback position with debounced POST to
 * the server and an optional SSE subscription for cross-device sync.
 *
 * - Writes go to IndexedDB immediately (offline-first).
 * - Writes are debounced (default 1500ms) before being POSTed to the server.
 * - On reconnect / mount, we fetch the server's position and reconcile with
 *   the local one (server wins on conflict, then local is updated).
 * - The SSE channel is the v1 plan's "lightweight SSE polling from the BFF
 *   keyed by `updatedAt`" pattern — cheaper than WebSockets for low-frequency
 *   position updates. Wired as an interface in Phase 1; full implementation
 *   lands when `/api/positions/sse` exists.
 */

import type { PlaybackPosition } from "../types";
import {
  getPosition,
  putPosition,
  listPositionsForUser,
} from "./idb-cache";

const POST_DEBOUNCE_MS = 1500;

export interface PositionServerAdapter {
  /** Fetch the canonical position for a (user, document). */
  fetchPosition(userId: string, documentId: string): Promise<PlaybackPosition | null>;
  /** Send the local position to the server. */
  postPosition(position: PlaybackPosition): Promise<PlaybackPosition>;
  /** Subscribe to remote updates via SSE. Returns an unsubscribe function. */
  subscribe(
    userId: string,
    onPosition: (position: PlaybackPosition) => void,
    onError?: (error: Event) => void,
  ): () => void;
}

export interface PositionStoreOptions {
  userId: string;
  documentId: string;
  /** Server adapter — defaults to fetch-based. SSE wiring in Phase 2. */
  adapter?: PositionServerAdapter;
  /** Debounce window in ms. */
  debounceMs?: number;
}

export class PositionStore {
  private readonly userId: string;
  private readonly documentId: string;
  private readonly adapter: PositionServerAdapter;
  private readonly debounceMs: number;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private current: PlaybackPosition | null = null;

  constructor(opts: PositionStoreOptions) {
    this.userId = opts.userId;
    this.documentId = opts.documentId;
    this.adapter = opts.adapter ?? defaultAdapter;
    this.debounceMs = opts.debounceMs ?? POST_DEBOUNCE_MS;
  }

  /** Read local → server; reconcile. */
  async load(): Promise<PlaybackPosition | null> {
    const local = (await getPosition(this.userId, this.documentId)) ?? null;
    let remote: PlaybackPosition | null = null;
    try {
      remote = await this.adapter.fetchPosition(this.userId, this.documentId);
    } catch {
      // Network failure → fall back to local.
    }
    const winner = chooseWinner(local, remote);
    if (winner) {
      await putPosition(winner);
    }
    this.current = winner;
    return winner;
  }

  /**
   * Update position locally and schedule a debounced POST to the server.
   * Call this from the player on every word-advance (rate-limited upstream).
   */
  update(partial: Pick<PlaybackPosition, "wordOffset" | "speed">): PlaybackPosition {
    const now = new Date().toISOString();
    const next: PlaybackPosition = {
      userId: this.userId,
      documentId: this.documentId,
      wordOffset: partial.wordOffset,
      speed: partial.speed,
      lastPlayedAt: now,
      updatedAt: now,
    };
    this.current = next;
    void putPosition(next);
    if (this.pending) clearTimeout(this.pending);
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.adapter.postPosition(next).catch(() => {
        // Silent retry-on-next-update — the next update will re-POST.
      });
    }, this.debounceMs);
    return next;
  }

  /** Force-flush any pending POST (e.g. on pause or page hide). */
  async flush(): Promise<void> {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    if (this.current) {
      try {
        await this.adapter.postPosition(this.current);
      } catch {
        // Will retry on next update.
      }
    }
  }

  /** Subscribe to remote updates (SSE) for cross-device resume. */
  subscribeRemote(
    onPosition: (position: PlaybackPosition) => void,
    onError?: (error: Event) => void,
  ): () => void {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.adapter.subscribe(
      this.userId,
      async (remote) => {
        if (remote.documentId !== this.documentId) return;
        if (
          this.current &&
          new Date(remote.updatedAt).getTime() <=
            new Date(this.current.updatedAt).getTime()
        ) {
          return;
        }
        await putPosition(remote);
        this.current = remote;
        onPosition(remote);
      },
      onError,
    );
    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  /** Hydrate the library's resume shelves for a user. */
  static async listForUser(userId: string): Promise<PlaybackPosition[]> {
    return listPositionsForUser(userId);
  }
}

function chooseWinner(
  local: PlaybackPosition | null,
  remote: PlaybackPosition | null,
): PlaybackPosition | null {
  if (!local) return remote;
  if (!remote) return local;
  return new Date(local.updatedAt).getTime() >=
    new Date(remote.updatedAt).getTime()
    ? local
    : remote;
}

// =============================================================================
// Default server adapter — fetch-based, SSE stub.
// Wired in Phase 2 against the real /api/positions endpoints.
// =============================================================================

const defaultAdapter: PositionServerAdapter = {
  async fetchPosition(userId, documentId) {
    const res = await fetch(
      `/api/positions?userId=${encodeURIComponent(userId)}&documentId=${encodeURIComponent(documentId)}`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    return (await res.json()) as PlaybackPosition;
  },
  async postPosition(position) {
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(position),
    });
    if (!res.ok) throw new Error(`position POST failed: ${res.status}`);
    return (await res.json()) as PlaybackPosition;
  },
  subscribe(userId, onPosition, onError) {
    // Stub interface — full SSE wiring arrives when the BFF endpoint exists.
    if (typeof EventSource === "undefined") return () => undefined;
    const es = new EventSource(
      `/api/positions/stream?userId=${encodeURIComponent(userId)}`,
      { withCredentials: true },
    );
    es.addEventListener("position", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as PlaybackPosition;
        onPosition(data);
      } catch {
        // Drop malformed events.
      }
    });
    es.onerror = (event) => {
      onError?.(event);
    };
    return () => es.close();
  },
};