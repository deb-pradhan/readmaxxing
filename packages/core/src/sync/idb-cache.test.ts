/**
 * IndexedDB cache round-trip tests — exercise every store via fake-indexeddb.
 *
 * Per UI-UX.md §4.12 (offline-first) the cache must survive reloads, which
 * means round-tripping through all 5 stores without losing shape.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import type { DocumentMeta, PlaybackPosition, SegmentTree, CachedAudioChunk } from "../types";
import {
  getDb,
  putDocument,
  getDocument,
  listDocuments,
  putSegmentTree,
  getSegmentTree,
  putAudioChunk,
  getAudioChunk,
  listAudioChunksForDocument,
  deleteAudioChunksForDocument,
  putPosition,
  getPosition,
  listPositionsForUser,
  getUserPreferences,
  putUserPreferences,
} from "./idb-cache";

const sampleDoc = (id: string): DocumentMeta => ({
  id,
  segmentTreeId: `tree-${id}`,
  source: "pasted",
  sourceType: "paste",
  title: `Doc ${id}`,
  author: null,
  coverUrl: null,
  tags: [],
  sizeBytes: 0,
  addedAt: new Date().toISOString(),
  pinned: false,
  archivedAt: null,
});

const sampleTree = (id: string): SegmentTree => ({
  segmentTreeId: `tree-${id}`,
  documentId: id,
  title: `Tree ${id}`,
  author: null,
  language: "en",
  text: "Hello world.",
  paragraphs: [
    {
      text: "Hello world.",
      start: 0,
      end: 12,
      index: 0,
      headingLevel: 0,
      sentences: [
        {
          text: "Hello world.",
          start: 0,
          end: 12,
          index: 0,
          words: [
            { text: "Hello", start: 0, end: 5, index: 0 },
            { text: "world.", start: 6, end: 12, index: 1 },
          ],
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  wordCount: 2,
  estimatedReadTimeSeconds: 1,
});

const sampleChunk = (docId: string, idx: number): CachedAudioChunk => ({
  id: `${docId}#${idx}`,
  documentId: docId,
  chunkIndex: idx,
  blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" }),
  durationSeconds: 12,
  speechMarks: [],
  cachedAt: new Date().toISOString(),
  voiceId: "eleven_rachel",
});

const samplePosition = (userId: string, docId: string, wordOffset = 5): PlaybackPosition => ({
  userId,
  documentId: docId,
  wordOffset,
  speed: 1,
  lastPlayedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(async () => {
  // Reset the DB between tests by deleting all keys.
  const db = await getDb();
  const tx = db.transaction(
    ["documents", "segment-trees", "audio-chunks", "positions", "user-preferences"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("documents").clear(),
    tx.objectStore("segment-trees").clear(),
    tx.objectStore("audio-chunks").clear(),
    tx.objectStore("positions").clear(),
    tx.objectStore("user-preferences").clear(),
  ]);
  await tx.done;
});

describe("IndexedDB cache — documents store", () => {
  it("putDocument + getDocument round-trips", async () => {
    const doc = sampleDoc("d1");
    await putDocument(doc);
    const got = await getDocument("d1");
    expect(got).toEqual(doc);
  });

  it("listDocuments returns all docs", async () => {
    await putDocument(sampleDoc("d1"));
    await putDocument(sampleDoc("d2"));
    const all = await listDocuments();
    expect(all.map((d) => d.id).sort()).toEqual(["d1", "d2"]);
  });
});

describe("IndexedDB cache — segment-trees store", () => {
  it("putSegmentTree + getSegmentTree round-trips", async () => {
    const tree = sampleTree("d1");
    await putSegmentTree(tree);
    const got = await getSegmentTree("tree-d1");
    expect(got).toEqual(tree);
  });
});

describe("IndexedDB cache — audio-chunks store", () => {
  it("putAudioChunk + getAudioChunk round-trips", async () => {
    const chunk = sampleChunk("d1", 0);
    await putAudioChunk(chunk);
    const got = await getAudioChunk(chunk.id);
    expect(got).toEqual(chunk);
  });

  it("listAudioChunksForDocument filters by documentId", async () => {
    await putAudioChunk(sampleChunk("d1", 0));
    await putAudioChunk(sampleChunk("d1", 1));
    await putAudioChunk(sampleChunk("d2", 0));
    const d1 = await listAudioChunksForDocument("d1");
    expect(d1.map((c) => c.chunkIndex).sort()).toEqual([0, 1]);
  });

  it("deleteAudioChunksForDocument removes only matching chunks", async () => {
    await putAudioChunk(sampleChunk("d1", 0));
    await putAudioChunk(sampleChunk("d1", 1));
    await putAudioChunk(sampleChunk("d2", 0));
    await deleteAudioChunksForDocument("d1");
    const remaining = await listAudioChunksForDocument("d1");
    expect(remaining).toEqual([]);
    const d2 = await listAudioChunksForDocument("d2");
    expect(d2.map((c) => c.chunkIndex)).toEqual([0]);
  });
});

describe("IndexedDB cache — positions store", () => {
  it("putPosition + getPosition round-trips", async () => {
    const pos = samplePosition("u1", "d1");
    await putPosition(pos);
    const got = await getPosition("u1", "d1");
    expect(got).toEqual(pos);
  });

  it("listPositionsForUser returns only that user's positions", async () => {
    await putPosition(samplePosition("u1", "d1"));
    await putPosition(samplePosition("u1", "d2"));
    await putPosition(samplePosition("u2", "d1"));
    const u1 = await listPositionsForUser("u1");
    expect(u1.map((p) => p.documentId).sort()).toEqual(["d1", "d2"]);
  });
});

describe("IndexedDB cache — user-preferences store", () => {
  it("getUserPreferences returns defaults when empty", async () => {
    const prefs = await getUserPreferences();
    expect(prefs.theme).toBe("light");
    expect(prefs.font).toBe("serif");
    expect(prefs.defaultSpeed).toBe(1);
  });

  it("putUserPreferences merges with defaults", async () => {
    await putUserPreferences({ theme: "dark", defaultSpeed: 1.5 });
    const prefs = await getUserPreferences();
    expect(prefs.theme).toBe("dark");
    expect(prefs.defaultSpeed).toBe(1.5);
    expect(prefs.font).toBe("serif"); // default preserved
  });
});