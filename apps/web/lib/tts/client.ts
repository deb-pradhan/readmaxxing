"use client";

/**
 * Browser-side TTS client.
 *
 * The contract is intentionally small:
 *   const { audioUrl, marks, fromCache } = await clientSynthesize({ text, voiceId, speed });
 *
 * On the first call for a given `(text, voiceId, speed)` triple the client
 * POSTs `/api/tts`, receives `{ audioUrl, marks }`, and caches the audio
 * blob + marks in IndexedDB. Subsequent calls hit the cache and never
 * touch the network (UI-UX.md §4.12 — offline-first).
 */

import type { SpeechMark } from "@readmaxxing/core";
import {
  getAudioChunk,
  putAudioChunk,
  audioChunkKey,
  type PutAudioChunkInput,
} from "@/lib/indexeddb/cache";

export interface ClientSynthesizeRequest {
  text: string;
  voiceId: string;
  speed: number;
  /** Optional explicit document id (helps the BFF persist for analytics). */
  documentId?: string;
}

export interface ClientSynthesizeResponse {
  /** Object URL for the audio — caller must `URL.revokeObjectURL` on cleanup. */
  audioUrl: string;
  marks: SpeechMark[];
  /** True when the response was served from IndexedDB. */
  fromCache: boolean;
}

export interface ClientSynthesizeError {
  code: "invalid_request" | "unauthorized" | "provider_error" | "network_error";
  message: string;
}

/** Public API. */
export async function clientSynthesize(
  req: ClientSynthesizeRequest,
): Promise<ClientSynthesizeResponse> {
  if (!req.text || !req.voiceId) {
    throw {
      code: "invalid_request",
      message: "clientSynthesize: text and voiceId are required.",
    } satisfies ClientSynthesizeError;
  }

  // Hash key for the audio cache. We use the (voice, speed, length-bucket)
  // triple rather than the full text so the cache survives whitespace edits.
  const cacheKey = {
    documentId: req.documentId ?? textHashKey(req.text),
    voiceId: req.voiceId,
    speed: req.speed,
    chunkIndex: 0,
  };

  const cached = await getAudioChunk(cacheKey).catch(() => undefined);
  if (cached?.blob) {
    return {
      audioUrl: URL.createObjectURL(cached.blob),
      marks: cached.speechMarks,
      fromCache: true,
    };
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw {
      code: res.status === 401 ? "unauthorized" : "provider_error",
      message: `TTS request failed (${res.status}): ${body || res.statusText}`,
    } satisfies ClientSynthesizeError;
  }
  const payload = (await res.json()) as {
    // `/api/tts` returns the base64 MP3 under `audio` (the SpeechMarkChunk
    // field); `audioBase64`/`audioUrl` are accepted as fallbacks.
    audio?: string;
    audioUrl?: string;
    audioBase64?: string;
    marks: SpeechMark[];
    durationSeconds?: number;
    fromCache?: boolean;
  };

  let blob: Blob;
  let audioUrl: string;
  const base64Audio = payload.audio ?? payload.audioBase64;
  if (base64Audio) {
    const bytes = base64ToBytes(base64Audio);
    blob = new Blob([bytes as unknown as BlobPart], { type: "audio/mpeg" });
    audioUrl = URL.createObjectURL(blob);
  } else if (payload.audioUrl) {
    // Fetch the audio (route or proxy URL) into a Blob so we can cache it.
    const audioRes = await fetch(payload.audioUrl);
    blob = await audioRes.blob();
    audioUrl = URL.createObjectURL(blob);
  } else {
    throw {
      code: "provider_error",
      message: "TTS response missing audioUrl/audioBase64.",
    } satisfies ClientSynthesizeError;
  }

  // Fire-and-forget cache write — fail silently if IndexedDB is unavailable.
  const cacheInput: PutAudioChunkInput = {
    ...cacheKey,
    blob,
    speechMarks: payload.marks ?? [],
    durationSeconds: payload.durationSeconds ?? 0,
  };
  void putAudioChunk(cacheInput).catch(() => undefined);

  return {
    audioUrl,
    marks: payload.marks ?? [],
    fromCache: Boolean(payload.fromCache),
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function textHashKey(text: string): string {
  // Cheap FNV-1a → base36 — same family as packages/core's segment-tree hash.
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return "ad-hoc:" + (h1 >>> 0).toString(36);
}

export const __testing = { audioChunkKey };