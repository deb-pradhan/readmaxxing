"use client";

/**
 * IndexedDB cache — idb-keyval wrapper for the offline-first client.
 *
 * Per the v1 plan §"Blobs — hybrid (Option B)":
 *  - segment tree + positions + metadata → Postgres (canonical)
 *  - raw uploaded files (PDF/DOCX/etc.)  → IndexedDB only (private)
 *  - TTS audio chunks + speech marks      → IndexedDB per device
 *
 * The implementation is a thin wrapper around `idb-keyval` for the simple
 * key/value cases + a thin call surface for the typed CachedAudioChunk
 * shape used by the player. Phase 2 adds the structured idb schema in
 * `packages/core/src/sync/idb-cache.ts`; this wrapper co-exists with it
 * and is the **only** one the web app's components import.
 */

import {
  createStore,
  get as idbGet,
  set as idbSet,
  del as idbDel,
  keys as idbKeys,
  values as idbValues,
  type UseStore,
} from "idb-keyval";

import type { CachedAudioChunk, PlaybackPosition, SegmentTree } from "@readmaxxing/core";

/** Composite key for an audio chunk: `${documentId}#${voiceId}#${speed}#${chunkIndex}`. */
export function audioChunkKey(args: {
  documentId: string;
  voiceId: string;
  speed: number;
  chunkIndex: number;
}): string {
  const speed = args.speed.toFixed(2);
  return `${args.documentId}#${args.voiceId}#${speed}#${args.chunkIndex}`;
}

/** Composite key for a position: `${userId}#${documentId}`. */
export function positionKey(args: { userId: string; documentId: string }): string {
  return `${args.userId}#${args.documentId}`;
}

/** Composite key for a cached segment tree. */
export function segmentTreeKey(segmentTreeId: string): string {
  return `tree:${segmentTreeId}`;
}

// =============================================================================
// Per-namespace stores — idb-keyval defaults to a single "keyval-store"
// DB, but we segregate by store name so a corrupt chunk cache can't take
// down the segment-tree cache.
// =============================================================================

function openStore(name: string): UseStore {
  return createStore("readmaxxing", name);
}

const audioStore = openStore("audio-chunks");
const treeStore = openStore("segment-trees");
const positionStore = openStore("positions");
const prefsStore = openStore("user-preferences");

// =============================================================================
// Audio chunks
// =============================================================================

export interface PutAudioChunkInput {
  documentId: string;
  voiceId: string;
  speed: number;
  chunkIndex: number;
  blob: Blob;
  speechMarks: CachedAudioChunk["speechMarks"];
  durationSeconds: number;
}

export async function putAudioChunk(input: PutAudioChunkInput): Promise<void> {
  const id = audioChunkKey(input);
  const value: CachedAudioChunk = {
    id,
    documentId: input.documentId,
    chunkIndex: input.chunkIndex,
    voiceId: input.voiceId,
    blob: input.blob,
    speechMarks: input.speechMarks,
    durationSeconds: input.durationSeconds,
    cachedAt: new Date().toISOString(),
  };
  await idbSet(id, value, audioStore);
}

export async function getAudioChunk(args: {
  documentId: string;
  voiceId: string;
  speed: number;
  chunkIndex: number;
}): Promise<CachedAudioChunk | undefined> {
  const id = audioChunkKey(args);
  return (await idbGet<CachedAudioChunk>(id, audioStore)) ?? undefined;
}

export async function listAudioChunksForDocument(documentId: string): Promise<CachedAudioChunk[]> {
  const all = (await idbValues<CachedAudioChunk>(audioStore)) ?? [];
  return all.filter((c) => c.documentId === documentId);
}

export async function deleteAudioChunksForDocument(documentId: string): Promise<void> {
  const keys = (await idbKeys(audioStore)) as string[];
  await Promise.all(
    keys.filter((k) => k.startsWith(`${documentId}#`)).map((k) => idbDel(k, audioStore)),
  );
}

// =============================================================================
// Segment trees (read-through cache for the BFF)
// =============================================================================

export async function putSegmentTree(tree: SegmentTree): Promise<void> {
  await idbSet(segmentTreeKey(tree.segmentTreeId), tree, treeStore);
}

export async function getSegmentTree(segmentTreeId: string): Promise<SegmentTree | undefined> {
  return (await idbGet<SegmentTree>(segmentTreeKey(segmentTreeId), treeStore)) ?? undefined;
}

// =============================================================================
// Positions
// =============================================================================

export async function putPosition(position: PlaybackPosition): Promise<void> {
  await idbSet(positionKey(position), position, positionStore);
}

export async function getPosition(args: {
  userId: string;
  documentId: string;
}): Promise<PlaybackPosition | undefined> {
  return (await idbGet<PlaybackPosition>(positionKey(args), positionStore)) ?? undefined;
}

export async function listPositions(): Promise<PlaybackPosition[]> {
  return ((await idbValues<PlaybackPosition>(positionStore)) ?? []) as PlaybackPosition[];
}

// =============================================================================
// User preferences — flat record, single id `current`.
// =============================================================================

export interface UserPreferences {
  theme?: "light" | "dark" | "sepia" | "eink";
  font?: "serif" | "sans" | "dyslexia";
  defaultSpeed?: number;
  defaultVoiceId?: string;
  bionicReading?: boolean;
  focusMode?: boolean;
  notificationsEnabled?: boolean;
}

const DEFAULTS: UserPreferences = {
  theme: "light",
  font: "serif",
  defaultSpeed: 1,
  notificationsEnabled: true,
  bionicReading: false,
  focusMode: false,
};

export async function getUserPreferences(): Promise<UserPreferences> {
  const stored = await idbGet<UserPreferences>("current", prefsStore);
  return { ...DEFAULTS, ...(stored ?? {}) };
}

export async function putUserPreferences(prefs: UserPreferences): Promise<UserPreferences> {
  const next = { ...(await getUserPreferences()), ...prefs };
  await idbSet("current", next, prefsStore);
  return next;
}