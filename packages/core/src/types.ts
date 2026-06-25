/**
 * Normalized document model — the single representation shared by web,
 * extension, and mobile.
 *
 * Per docs/UI-UX.md §1 (the content is the hero) and the v1 plan §"Document
 * pipeline": a document is split into Paragraph → Sentence → Word with
 * character offsets so TTS chunking, karaoke highlighting, AI summary,
 * quiz, recap, podcast script, and search all operate on the same tree.
 *
 * `segmentTreeId` is a stable hash of the source text so identical uploads
 * dedupe to the same row in Postgres.
 */

export interface Word {
  /** Text content, including attached punctuation where natural. */
  text: string;
  /** Inclusive start offset into the original document text (chars). */
  start: number;
  /** Exclusive end offset into the original document text (chars). */
  end: number;
  /** Sequential index inside the parent sentence (0-based). */
  index: number;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
  index: number;
  words: Word[];
}

export interface Paragraph {
  text: string;
  start: number;
  end: number;
  index: number;
  /** Optional heading rank (0 = body). Used for skip-to-chapter controls. */
  headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  sentences: Sentence[];
}

export interface SegmentTree {
  /** Stable content hash — SHA-1 of normalized text. */
  segmentTreeId: string;
  /** Source document id (provider-specific). */
  documentId: string;
  /** Detected title, if any. */
  title: string | null;
  /** Detected author, if any. */
  author: string | null;
  /** Detected language (BCP-47). Defaults to "en". */
  language: string;
  /** Full normalized text (the canonical, deduplicated source). */
  text: string;
  paragraphs: Paragraph[];
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Total word count (cached for progress UI). */
  wordCount: number;
  /** Estimated read time in seconds at 1x speed, assuming ~155 wpm. */
  estimatedReadTimeSeconds: number;
}

/** Re-export `SpeechMark` so consumers can `import { SpeechMark } from "@readmaxxing/core"`. */
export type { SpeechMark, SpeechMarkType } from "@readmaxxing/tts";

/** Document metadata stored alongside the segment tree. */
export interface DocumentMeta {
  id: string;
  segmentTreeId: string;
  /** Source URL or "pasted" / file name. */
  source: string;
  /** "pdf" | "docx" | "md" | "epub" | "txt" | "url" | "paste" */
  sourceType: DocumentSourceType;
  title: string;
  author: string | null;
  coverUrl: string | null;
  tags: string[];
  /** Bytes — only meaningful when sourceType is a file. 0 otherwise. */
  sizeBytes: number;
  addedAt: string;
  /** When true, do not delete this doc on archive. */
  pinned: boolean;
  archivedAt: string | null;
}

export type DocumentSourceType =
  | "pdf"
  | "docx"
  | "md"
  | "epub"
  | "txt"
  | "url"
  | "paste";

/** Playback position — synced cross-device. */
export interface PlaybackPosition {
  userId: string;
  documentId: string;
  /** Word offset (preferred) for resume-to-exact-word per UI-UX.md §4.3. */
  wordOffset: number;
  /** Playback speed at last update. */
  speed: number;
  /** Last played at, ISO 8601. */
  lastPlayedAt: string;
  /** Optimistic-concurrency field updated by Postgres trigger. */
  updatedAt: string;
}

/** Audio chunk + speech marks cached in IndexedDB. */
export interface CachedAudioChunk {
  /** Composite key: `${documentId}#${chunkIndex}`. */
  id: string;
  documentId: string;
  chunkIndex: number;
  /** Mono MPEG-TS / MP3 bytes. */
  blob: Blob;
  /** Wall-clock duration of the chunk in seconds. */
  durationSeconds: number;
  /** Speech marks aligned to the audio. */
  speechMarks: import("@readmaxxing/tts").SpeechMark[];
  cachedAt: string;
  voiceId: string;
}

export const WORDS_PER_MINUTE = 155;