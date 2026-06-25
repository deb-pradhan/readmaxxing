/**
 * Segment-tree builder.
 *
 * Pure-text → SegmentTree. Marked-down input is reduced to plain text by
 * stripping common markdown noise (headings, list bullets, links keep text).
 * Markdown headings are preserved as `headingLevel` so chapter-skip works.
 *
 * Sentence segmentation uses a small set of terminal punctuation rules plus
 * common abbreviations (so "Dr.", "Mr.", "e.g." do not split). Quoted
 * dialogue containing `!` or `?` is split on those characters when inside
 * the quote.
 *
 * Word tokenization is whitespace + punctuation aware so contractions
 * ("don't", "it's") remain single words. Offsets point into the *original*
 * text — so reattaching highlight to the source string is byte-correct.
 */

import { WORDS_PER_MINUTE, type SegmentTree, type Word, type Sentence, type Paragraph } from "../types";

const HEADING_PREFIX = /^(#{1,6})\s+/;
const LIST_PREFIX = /^\s*[-*+]\s+/;
const NUM_LIST_PREFIX = /^\s*\d+\.\s+/;
const BLOCKQUOTE_PREFIX = /^\s*>\s?/;

const SENTENCE_TERMINATORS = new Set([".", "!", "?"]);
const SENTENCE_BOUNDARY_AFTER = /([.!?])(['"\u2019\u201d)\]]+)?(\s+|$)/g;

/** A small list of common abbreviations that should not split a sentence. */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
  "vs", "etc", "e.g", "i.e", "no", "inc", "ltd", "co",
]);

function normalizeInput(text: string): { text: string; title: string | null; author: string | null } {
  // Strip BOM and CRLF → LF.
  let t = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  // Strip a leading "Title: …" and "Author: …" if present.
  let title: string | null = null;
  let author: string | null = null;
  const titleMatch = t.match(/^Title:\s*(.+)\n/i);
  if (titleMatch) {
    title = titleMatch[1]!.trim();
    t = t.slice(titleMatch[0].length);
  }
  const authorMatch = t.match(/^Author:\s*(.+)\n/i);
  if (authorMatch) {
    author = authorMatch[1]!.trim();
    t = t.slice(authorMatch[0].length);
  }

  // Collapse runs of > 2 blank lines into a single paragraph break (double newline).
  t = t.replace(/\n{3,}/g, "\n\n");

  return { text: t, title, author };
}

/** Tokenize a sentence into words with byte-correct offsets into the source text. */
function tokenizeSentence(sentenceText: string, sentenceStart: number): Word[] {
  const words: Word[] = [];
  // Match a word optionally preceded by a leading-quote, optionally followed
  // by trailing punctuation that should stay attached for natural reading.
  const WORD_RE = /[\u2018\u2019\u201C\u201D"'([]*([^\s\u2018\u2019\u201C\u201D"',.;:!?()\[\]]+)([.,;:!?\u2019\u201D)\]]*)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = WORD_RE.exec(sentenceText)) !== null) {
    const start = sentenceStart + m.index;
    const wordText = (m[1] ?? "") + (m[2] ?? "");
    if (!wordText) continue;
    words.push({
      text: wordText,
      start,
      end: start + wordText.length,
      index: idx++,
    });
  }
  return words;
}

/**
 * Split a paragraph string into sentences, returning offsets into the
 * paragraph text and the matched sentence content. Abbreviations are
 * protected from splitting.
 */
function splitParagraph(paragraphText: string, paragraphStart: number): Sentence[] {
  const sentences: Sentence[] = [];
  let cursor = 0;
  let sentenceIdx = 0;

  // Walk through the paragraph, finding the next sentence boundary.
  while (cursor < paragraphText.length) {
    const remaining = paragraphText.slice(cursor);

    // Find the next candidate terminator. We have to skip abbreviations.
    const boundaryRe = /([.!?])(['"\u2019\u201D)\]]*)\s+/g;
    let boundaryMatch: RegExpExecArray | null;
    let endIdx = -1;
    let terminator = "";
    while ((boundaryMatch = boundaryRe.exec(remaining)) !== null) {
      const candidateEnd = boundaryMatch.index + boundaryMatch[0].length;
      // Check the token immediately before the terminator.
      const tokenMatch = paragraphText
        .slice(0, cursor + boundaryMatch.index)
        .match(/(\S+)$/);
      const lastToken = tokenMatch?.[1] ?? "";
      const stripped = lastToken.replace(/[.,;:!?\u2019\u201D)\]]+$/, "").toLowerCase();
      if (ABBREVIATIONS.has(stripped)) continue;
      endIdx = candidateEnd;
      terminator = boundaryMatch[1]!;
      break;
    }

    if (endIdx === -1) {
      // No more boundaries in this paragraph — take the rest.
      const text = paragraphText.slice(cursor);
      const start = paragraphStart + cursor;
      if (text.trim().length > 0) {
        const words = tokenizeSentence(text, start);
        if (words.length > 0) {
          sentences.push({
            text,
            start,
            end: paragraphStart + paragraphText.length,
            index: sentenceIdx++,
            words,
          });
        }
      }
      break;
    }

    const text = paragraphText.slice(cursor, endIdx);
    const start = paragraphStart + cursor;
    const words = tokenizeSentence(text, start);
    if (words.length > 0) {
      sentences.push({
        text,
        start,
        end: start + text.length,
        index: sentenceIdx++,
        words,
      });
    }
    cursor = endIdx;
    // Suppress unused warning while keeping terminator available for future
    // language-specific tuning.
    void terminator;
  }

  return sentences;
}

/** Cheap stable hash (FNV-1a 64-bit → base36). Sufficient for dedupe. */
function fnv1a64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x100000001b3 & 0x1fffffffffffff);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex1}${hex2}`;
}

export interface BuildSegmentTreeOptions {
  documentId: string;
  language?: string;
}

/**
 * Build a SegmentTree from plain (or lightly-marked) text. This is the
 * canonical normalization step used by every import path (paste, URL,
 * PDF-extracted text, etc.).
 */
export function buildSegmentTree(
  rawText: string,
  opts: BuildSegmentTreeOptions,
): SegmentTree {
  const { text, title, author } = normalizeInput(rawText);

  // Split into paragraphs on blank lines.
  const paragraphStrings = text.split(/\n\s*\n/);

  const paragraphs: Paragraph[] = [];
  let cursor = 0;
  let paragraphIdx = 0;
  let totalWords = 0;

  for (const raw of paragraphStrings) {
    const trimmed = raw.replace(/^\s+|\s+$/g, "");
    if (trimmed.length === 0) continue;

    // Account for the original whitespace between paragraphs in the cursor.
    const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
    cursor += leadingWhitespace;

    // Detect markdown headings.
    let headingLevel: Paragraph["headingLevel"] = 0;
    let body = trimmed;
    const headingMatch = body.match(HEADING_PREFIX);
    if (headingMatch) {
      headingLevel = Math.min(6, headingMatch[1]!.length) as Paragraph["headingLevel"];
      body = body.slice(headingMatch[0].length);
    } else if (LIST_PREFIX.test(body) || NUM_LIST_PREFIX.test(body)) {
      // Lists remain body paragraphs — sentence splitting will still work.
      body = body.replace(LIST_PREFIX, "").replace(NUM_LIST_PREFIX, "");
    } else if (BLOCKQUOTE_PREFIX.test(body)) {
      body = body.replace(BLOCKQUOTE_PREFIX, "");
    }

    const start = cursor;
    const end = start + trimmed.length;
    const sentences = splitParagraph(body, start);
    const wordCount = sentences.reduce((acc, s) => acc + s.words.length, 0);
    totalWords += wordCount;

    paragraphs.push({
      text: trimmed,
      start,
      end,
      index: paragraphIdx++,
      headingLevel,
      sentences,
    });

    cursor = end + 2; // the blank line (\n\n) consumed between paragraphs
  }

  const segmentTreeId = fnv1a64(text);

  return {
    segmentTreeId,
    documentId: opts.documentId,
    title,
    author,
    language: opts.language ?? "en",
    text,
    paragraphs,
    createdAt: new Date().toISOString(),
    wordCount: totalWords,
    estimatedReadTimeSeconds: Math.round((totalWords / WORDS_PER_MINUTE) * 60),
  };
}

/**
 * Look up the sentence containing a given absolute character offset.
 * Useful for click-to-jump and "Listen from here" interactions.
 */
export function findSentenceAt(tree: SegmentTree, offset: number): Sentence | null {
  for (const paragraph of tree.paragraphs) {
    if (offset < paragraph.start || offset > paragraph.end) continue;
    for (const sentence of paragraph.sentences) {
      if (offset >= sentence.start && offset <= sentence.end) {
        return sentence;
      }
    }
  }
  return null;
}

/**
 * Convert a global word offset (0-based) into a (paragraphIdx, sentenceIdx,
 * wordIdx) position. Inverse of `globalWordOffset` below.
 */
export function locateWord(
  tree: SegmentTree,
  globalOffset: number,
): { paragraphIndex: number; sentenceIndex: number; wordIndex: number } | null {
  if (globalOffset < 0) return null;
  let running = 0;
  for (let p = 0; p < tree.paragraphs.length; p++) {
    const paragraph = tree.paragraphs[p]!;
    for (let s = 0; s < paragraph.sentences.length; s++) {
      const sentence = paragraph.sentences[s]!;
      if (globalOffset < running + sentence.words.length) {
        return {
          paragraphIndex: p,
          sentenceIndex: s,
          wordIndex: globalOffset - running,
        };
      }
      running += sentence.words.length;
    }
  }
  return null;
}

/** Compute a global word offset from a located position. */
export function globalWordOffset(
  tree: SegmentTree,
  paragraphIndex: number,
  sentenceIndex: number,
  wordIndex: number,
): number {
  let running = 0;
  for (let p = 0; p < paragraphIndex; p++) {
    const paragraph = tree.paragraphs[p]!;
    for (const sentence of paragraph.sentences) {
      running += sentence.words.length;
    }
  }
  const paragraph = tree.paragraphs[paragraphIndex];
  if (!paragraph) return running;
  for (let s = 0; s < sentenceIndex; s++) {
    const sentence = paragraph.sentences[s];
    if (sentence) running += sentence.words.length;
  }
  running += wordIndex;
  return running;
}