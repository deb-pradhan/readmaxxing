/**
 * Segment tree builder tests.
 *
 * The segment tree is the universal document model — consumed by the web
 * app, the chrome extension (later), the mobile app (later), AND the
 * python worker (whose own segment_tree.py mirrors this shape). These
 * tests pin the TS contract so the two implementations stay aligned.
 */

import { describe, it, expect } from "vitest";
import {
  buildSegmentTree,
  findSentenceAt,
  locateWord,
  globalWordOffset,
} from "../src/pipeline/segment-tree";
import { makePosition, chooseNewerPosition, isValidPosition, formatReadout } from "../src/positions";

describe("buildSegmentTree", () => {
  it("splits a single sentence into one word", () => {
    const tree = buildSegmentTree("Hello world.", { documentId: "doc-1" });
    expect(tree.wordCount).toBe(2);
    expect(tree.paragraphs).toHaveLength(1);
    expect(tree.paragraphs[0]?.sentences).toHaveLength(1);
    expect(tree.paragraphs[0]?.sentences[0]?.words.map((w) => w.text)).toEqual(["Hello", "world."]);
  });

  it("preserves offsets into the source text", () => {
    const tree = buildSegmentTree("Hello world.", { documentId: "doc-1" });
    const words = tree.paragraphs[0]?.sentences[0]?.words ?? [];
    expect(tree.text.slice(words[0]!.start, words[0]!.end)).toBe("Hello");
    expect(tree.text.slice(words[1]!.start, words[1]!.end)).toBe("world.");
  });

  it("splits paragraphs on blank lines", () => {
    const tree = buildSegmentTree("First paragraph.\n\nSecond paragraph.", {
      documentId: "doc-1",
    });
    expect(tree.paragraphs).toHaveLength(2);
    expect(tree.paragraphs[0]?.text).toBe("First paragraph.");
    expect(tree.paragraphs[1]?.text).toBe("Second paragraph.");
  });

  it("splits sentences on . ! ? but not on common abbreviations", () => {
    const text = "Dr. Smith met Mr. Jones at 5 p.m. Did they talk? Yes!";
    const tree = buildSegmentTree(text, { documentId: "doc-1" });
    const sentences = tree.paragraphs[0]?.sentences.map((s) => s.text.trim()) ?? [];
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.some((s) => s.includes("Dr. Smith"))).toBe(true);
    expect(sentences.some((s) => s.includes("Did they talk?"))).toBe(true);
    expect(sentences.some((s) => s.includes("Yes!"))).toBe(true);
  });

  it("does NOT split on common abbreviations like Dr. and Mr.", () => {
    const text = "Dr. Smith met Mr. Jones at noon. They had lunch.";
    const tree = buildSegmentTree(text, { documentId: "doc-1" });
    const joined = tree.paragraphs[0]?.sentences.map((s) => s.text.trim()).join(" ") ?? "";
    // Both abbreviations stay attached to the first sentence.
    expect(joined).toContain("Dr. Smith met Mr. Jones at noon.");
    expect(joined).toContain("They had lunch.");
  });

  it("keeps contractions and possessives as single words", () => {
    const tree = buildSegmentTree("I can't go. It's yours.", { documentId: "doc-1" });
    const words: string[] = [];
    for (const p of tree.paragraphs) for (const s of p.sentences) for (const w of s.words) words.push(w.text);
    expect(words).toEqual(["I", "can't", "go.", "It's", "yours."]);
  });

  it("preserves source offsets for contractions", () => {
    const tree = buildSegmentTree("You're right.", { documentId: "doc-1" });
    const w = tree.paragraphs[0]?.sentences[0]?.words[0];
    expect(w).toBeDefined();
    expect(w!.text).toBe("You're");
    expect(tree.text.slice(w!.start, w!.end)).toBe("You're");
  });

  it("handles apostrophe variants and possessives", () => {
    const tree = buildSegmentTree("It’s o'clock at James's.", { documentId: "doc-1" });
    const words: string[] = [];
    for (const p of tree.paragraphs) for (const s of p.sentences) for (const w of s.words) words.push(w.text);
    expect(words).toEqual(["It’s", "o'clock", "at", "James's."]);
  });

  it("extracts optional Title: / Author: prefixes", () => {
    const tree = buildSegmentTree("Title: My Doc\nAuthor: Jane\n\nBody text here.", {
      documentId: "doc-1",
    });
    expect(tree.title).toBe("My Doc");
    expect(tree.author).toBe("Jane");
    expect(tree.text).toContain("Body text here.");
  });

  it("treats markdown headings as paragraphs with headingLevel", () => {
    const tree = buildSegmentTree("# Heading 1\n\nBody paragraph.", {
      documentId: "doc-1",
    });
    expect(tree.paragraphs).toHaveLength(2);
    expect(tree.paragraphs[0]?.headingLevel).toBe(1);
    expect(tree.paragraphs[1]?.headingLevel).toBe(0);
  });

  it("computes estimated read time at WORDS_PER_MINUTE", () => {
    const tree = buildSegmentTree("one two three four five six seven eight nine ten", {
      documentId: "doc-1",
    });
    expect(tree.wordCount).toBe(10);
    // 10 words at 155 wpm ≈ 4s
    expect(tree.estimatedReadTimeSeconds).toBeGreaterThanOrEqual(3);
    expect(tree.estimatedReadTimeSeconds).toBeLessThanOrEqual(5);
  });

  it("dedupes identical content via the segmentTreeId hash", () => {
    const a = buildSegmentTree("Same text.", { documentId: "doc-1" });
    const b = buildSegmentTree("Same text.", { documentId: "doc-2" });
    expect(a.segmentTreeId).toBe(b.segmentTreeId);
  });
});

describe("locateWord / globalWordOffset", () => {
  it("round-trips through global offset", () => {
    const tree = buildSegmentTree("First sentence. Second sentence has more words.", {
      documentId: "doc-1",
    });
    const words: string[] = [];
    for (const p of tree.paragraphs) for (const s of p.sentences) for (const w of s.words)
      words.push(w.text);
    const offset = 4; // the 5th word in the document
    const located = locateWord(tree, offset);
    expect(located).not.toBeNull();
    const back = globalWordOffset(tree, located!.paragraphIndex, located!.sentenceIndex, located!.wordIndex);
    expect(back).toBe(offset);
    expect(words[back]).toBeDefined();
  });

  it("locateWord returns null for negative offsets", () => {
    const tree = buildSegmentTree("Hello.", { documentId: "doc-1" });
    expect(locateWord(tree, -1)).toBeNull();
  });
});

describe("findSentenceAt", () => {
  it("finds the sentence containing an offset", () => {
    const tree = buildSegmentTree("First sentence here. Second sentence there.", {
      documentId: "doc-1",
    });
    const firstSentence = tree.paragraphs[0]?.sentences[0];
    expect(firstSentence).toBeDefined();
    const offset = firstSentence!.start + 5;
    const found = findSentenceAt(tree, offset);
    expect(found).toBe(firstSentence);
  });
});

describe("makePosition", () => {
  it("clamps wordOffset to >= 0", () => {
    const p = makePosition({ userId: "u1", documentId: "d1", wordOffset: -5, speed: 1 });
    expect(p.wordOffset).toBe(0);
  });

  it("floors fractional wordOffset", () => {
    const p = makePosition({ userId: "u1", documentId: "d1", wordOffset: 12.9, speed: 1 });
    expect(p.wordOffset).toBe(12);
  });

  it("sets timestamps", () => {
    const p = makePosition({ userId: "u1", documentId: "d1", wordOffset: 5, speed: 1.5 });
    expect(p.userId).toBe("u1");
    expect(p.documentId).toBe("d1");
    expect(p.speed).toBe(1.5);
    expect(typeof p.lastPlayedAt).toBe("string");
    expect(typeof p.updatedAt).toBe("string");
  });
});

describe("chooseNewerPosition", () => {
  it("returns the remote position when remote is newer", () => {
    const local = makePosition({
      userId: "u",
      documentId: "d",
      wordOffset: 1,
      speed: 1,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const remote = makePosition({
      userId: "u",
      documentId: "d",
      wordOffset: 5,
      speed: 1,
      now: new Date("2026-01-02T00:00:00Z"),
    });
    expect(chooseNewerPosition(local, remote)?.wordOffset).toBe(5);
  });

  it("returns local when only local exists", () => {
    const local = makePosition({
      userId: "u",
      documentId: "d",
      wordOffset: 7,
      speed: 1,
    });
    expect(chooseNewerPosition(local, null)?.wordOffset).toBe(7);
  });

  it("returns null when both are null", () => {
    expect(chooseNewerPosition(null, null)).toBeNull();
  });
});

describe("isValidPosition", () => {
  it("accepts a real position", () => {
    const p = makePosition({ userId: "u", documentId: "d", wordOffset: 5, speed: 1 });
    expect(isValidPosition(p)).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition({})).toBe(false);
    expect(isValidPosition({ userId: "u" })).toBe(false);
  });
});

describe("formatReadout", () => {
  it("formats mm:ss", () => {
    expect(formatReadout(0)).toBe("0:00");
    expect(formatReadout(5)).toBe("0:05");
    expect(formatReadout(75)).toBe("1:15");
  });

  it("formats hh:mm:ss for > 1h", () => {
    expect(formatReadout(3600)).toBe("1:00:00");
    expect(formatReadout(3661)).toBe("1:01:01");
  });

  it("handles negative + non-finite gracefully", () => {
    expect(formatReadout(-1)).toBe("0:00");
    expect(formatReadout(Number.NaN)).toBe("0:00");
  });
});