/**
 * Voice catalog — single source of truth for `id → name` resolution.
 *
 * The UI surfaces voice *names* (e.g. "Alice", "Sarah") — never raw
 * ElevenLabs / OpenAI / Azure voice ids (`Xb7hH8MSUJpSbSDYk0k2`).
 *
 * Aggregating the static catalogs from each adapter at module load
 * means the reader and the voice picker resolve the same names
 * without duplicating the list. Per-provider `getVoices()` returns
 * the full objects; this module is the lightweight name lookup used
 * by server-side rendering and the player chrome.
 *
 * Phase E (E.2) — replaces the prior `voiceLabel = voiceId` fallback
 * (audit D finding).
 */

import { ElevenLabsAdapter } from "./adapters/elevenlabs";
import type { Voice } from "./provider";

/**
 * Joined catalog. We pull from each adapter's static list (lifted
 * from the class) rather than calling `getVoices()` — that avoids
 * constructing an adapter instance (which requires an API key) and
 * keeps the lookup pure & SSR-safe.
 */
const STATIC_VOICES: Voice[] = [
  ...ElevenLabsAdapter.STATIC_VOICES,
];

/**
 * Resolve a voice id (ElevenLabs `Xb7h…` slug, OpenAI `alloy`, or local
 * `local_amy`) to its display name. Returns `null` when the id is
 * unknown — callers should treat that as "voice not in catalog" and
 * surface a friendly fallback rather than leaking the raw id.
 */
export function resolveVoiceName(voiceId: string | null | undefined): string | null {
  if (!voiceId) return null;
  const hit = STATIC_VOICES.find((v) => v.id === voiceId);
  return hit ? hit.name : null;
}

/** Resolve to `{ id, name, provider }` (or `null` when unknown). */
export function resolveVoice(voiceId: string | null | undefined): Voice | null {
  if (!voiceId) return null;
  const hit = STATIC_VOICES.find((v) => v.id === voiceId);
  return hit ?? null;
}

/** All known voices — convenience re-export for pickers. */
export function listKnownVoices(): Voice[] {
  return [...STATIC_VOICES];
}