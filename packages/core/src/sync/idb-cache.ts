/**
 * IndexedDB cache — the offline-first source of truth for the client.
 *
 * Per the v1 plan §"Blobs — hybrid (Option B)":
 * - segment tree + positions + metadata → Postgres (canonical)
 * - raw uploaded files (PDF/DOCX/etc.)  → IndexedDB only (private)
 * - TTS audio chunks + speech marks      → IndexedDB per device
 *
 * Stores:
 *   documents         DocumentMeta[]                    key: id
 *   segment-trees     SegmentTree[]                     key: segmentTreeId
 *   audio-chunks      CachedAudioChunk[]                key: id (= `${docId}#${chunkIndex}`)
 *   positions         PlaybackPosition[]                key: `${userId}#${documentId}`
 *   user-preferences  Record<string, unknown>           key: string (single record "current")
 */

import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  CachedAudioChunk,
  DocumentMeta,
  PlaybackPosition,
  SegmentTree,
} from "../types";

const DB_NAME = "readmaxxing";
const DB_VERSION = 1;

interface ReadMaxxingDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentMeta;
    indexes: { "by-addedAt": string };
  };
  "segment-trees": {
    key: string;
    value: SegmentTree;
  };
  "audio-chunks": {
    key: string;
    value: CachedAudioChunk;
    indexes: { "by-documentId": string };
  };
  positions: {
    key: string;
    value: PlaybackPosition;
    indexes: { "by-userId": string; "by-documentId": string };
  };
  "user-preferences": {
    key: string;
    value: Record<string, unknown> & { id: string };
  };
}

let dbPromise: Promise<IDBPDatabase<ReadMaxxingDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ReadMaxxingDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available (SSR)"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ReadMaxxingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          const docs = db.createObjectStore("documents", { keyPath: "id" });
          docs.createIndex("by-addedAt", "addedAt");
        }
        if (!db.objectStoreNames.contains("segment-trees")) {
          db.createObjectStore("segment-trees", { keyPath: "segmentTreeId" });
        }
        if (!db.objectStoreNames.contains("audio-chunks")) {
          const audio = db.createObjectStore("audio-chunks", { keyPath: "id" });
          audio.createIndex("by-documentId", "documentId");
        }
        if (!db.objectStoreNames.contains("positions")) {
          const positions = db.createObjectStore("positions", {
            keyPath: ["userId", "documentId"],
          });
          positions.createIndex("by-userId", "userId");
          positions.createIndex("by-documentId", "documentId");
        }
        if (!db.objectStoreNames.contains("user-preferences")) {
          db.createObjectStore("user-preferences", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// =============================================================================
// Documents
// =============================================================================

export async function putDocument(doc: DocumentMeta): Promise<void> {
  const db = await getDb();
  await db.put("documents", doc);
}

export async function getDocument(id: string): Promise<DocumentMeta | undefined> {
  const db = await getDb();
  return db.get("documents", id);
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const db = await getDb();
  return db.getAllFromIndex("documents", "by-addedAt");
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("documents", id);
}

// =============================================================================
// Segment trees
// =============================================================================

export async function putSegmentTree(tree: SegmentTree): Promise<void> {
  const db = await getDb();
  await db.put("segment-trees", tree);
}

export async function getSegmentTree(
  segmentTreeId: string,
): Promise<SegmentTree | undefined> {
  const db = await getDb();
  return db.get("segment-trees", segmentTreeId);
}

// =============================================================================
// Audio chunks
// =============================================================================

export async function putAudioChunk(chunk: CachedAudioChunk): Promise<void> {
  const db = await getDb();
  await db.put("audio-chunks", chunk);
}

export async function getAudioChunk(
  id: string,
): Promise<CachedAudioChunk | undefined> {
  const db = await getDb();
  return db.get("audio-chunks", id);
}

export async function listAudioChunksForDocument(
  documentId: string,
): Promise<CachedAudioChunk[]> {
  const db = await getDb();
  return db.getAllFromIndex("audio-chunks", "by-documentId", documentId);
}

export async function deleteAudioChunksForDocument(
  documentId: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("audio-chunks", "readwrite");
  const keys = await tx.store.index("by-documentId").getAllKeys(documentId);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}

// =============================================================================
// Positions
// =============================================================================

export async function putPosition(position: PlaybackPosition): Promise<void> {
  const db = await getDb();
  await db.put("positions", position);
}

export async function getPosition(
  userId: string,
  documentId: string,
): Promise<PlaybackPosition | undefined> {
  const db = await getDb();
  // Composite key — idb v8's typed `get` API accepts a single IDBValidKey.
  // The Position store key is the [userId, documentId] tuple below.
  return db.get("positions", [userId, documentId] as unknown as string);
}

export async function listPositionsForUser(
  userId: string,
): Promise<PlaybackPosition[]> {
  const db = await getDb();
  return db.getAllFromIndex("positions", "by-userId", userId);
}

// =============================================================================
// User preferences
// =============================================================================

export interface UserPreferences extends Record<string, unknown> {
  id: "current";
  theme?: "light" | "dark" | "sepia" | "eink";
  font?: "serif" | "sans" | "dyslexia";
  defaultSpeed?: number;
  defaultVoiceId?: string;
  notificationsEnabled?: boolean;
  leaderboardsOptIn?: boolean;
  /** UI-UX.md §5 bionic-reading toggle. */
  bionicReading?: boolean;
  /** UI-UX.md §5 line guide toggle. */
  lineGuide?: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  id: "current",
  theme: "light",
  font: "serif",
  defaultSpeed: 1,
  notificationsEnabled: true,
  leaderboardsOptIn: true,
  bionicReading: false,
  lineGuide: false,
};

export async function getUserPreferences(): Promise<UserPreferences> {
  const db = await getDb();
  const stored = await db.get("user-preferences", "current");
  return { ...DEFAULT_PREFS, ...(stored ?? {}) } as UserPreferences;
}

export async function putUserPreferences(
  prefs: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const db = await getDb();
  const current = await getUserPreferences();
  const next: UserPreferences = { ...current, ...prefs, id: "current" };
  await db.put("user-preferences", next);
  return next;
}