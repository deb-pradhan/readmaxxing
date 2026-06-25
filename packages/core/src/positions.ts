/**
 * Playback position helpers — the cross-device resume layer (UI-UX.md §4.3,
 * §11). The Postgres row in `playback_positions` is the canonical state;
 * IndexedDB is the offline-first cache; SSE is the realtime transport.
 *
 * Kept pure-TS (no DB or DOM access) so the same logic powers the web
 * player, the chrome extension, and (later) the mobile app.
 */

import type { PlaybackPosition } from "./types";

/** Default debounce window for posting positions back to the server. */
export const POST_DEBOUNCE_MS = 500;

/**
 * Build a fresh `PlaybackPosition` row from a partial update. The server
 * fills `updatedAt` via the DB trigger; the client writes it locally so the
 * optimistic-concurrency check works offline.
 */
export function makePosition(args: {
  userId: string;
  documentId: string;
  wordOffset: number;
  speed: number;
  now?: Date;
}): PlaybackPosition {
  const now = args.now ?? new Date();
  return {
    userId: args.userId,
    documentId: args.documentId,
    wordOffset: Math.max(0, Math.floor(args.wordOffset)),
    speed: args.speed,
    lastPlayedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Pick the winner between a local + remote position (later wins). */
export function chooseNewerPosition(
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

/**
 * Convert a word offset into a `mm:ss` readout for the player UI.
 * Uses the segment tree's estimated read time at the current speed.
 */
export function formatReadout(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Validate a `PlaybackPosition`-shaped payload (used by the BFF). */
export function isValidPosition(value: unknown): value is PlaybackPosition {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["userId"] === "string" &&
    typeof v["documentId"] === "string" &&
    typeof v["wordOffset"] === "number" &&
    typeof v["speed"] === "number" &&
    typeof v["lastPlayedAt"] === "string" &&
    typeof v["updatedAt"] === "string"
  );
}