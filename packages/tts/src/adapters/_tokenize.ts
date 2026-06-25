/**
 * Text → `[start, end]` ranges for words + sentences.
 *
 * Shared by the ElevenLabs adapter and the BFF's `apps/web/app/api/tts`
 * route. Mirrors the segment-tree tokenization closely enough that the
 * word ranges line up with the segment tree's `Word.start` / `Word.end`,
 * so a client can use a speech-mark's `start` to index into the segment
 * tree and find the highlighted word.
 *
 * Intentionally rule-based (no `nltk`/ML): tiny, deterministic, fast, and
 * identical across the TS + Python worker implementations.
 */

export interface Range {
  start: number;
  end: number;
}

const SENTENCE_TERMINATORS = new Set([".", "!", "?"]);
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
  "vs", "etc", "e.g", "i.e", "no", "inc", "ltd", "co",
]);

const WORD_RE =
  /[\u2018\u2019\u201c\u201d"'([]*([^\s\u2018\u2019\u201c\u201d"',.;:!?()\[\]]+)([.,;:!?\u2019\u201d)\]]*)/g;

export function tokenizeForMarks(text: string): {
  words: Range[];
  sentences: Range[];
} {
  const words: Range[] = [];
  const sentences: Range[] = [];

  // Walk paragraph-by-paragraph so sentence boundaries don't span blank lines.
  let cursor = 0;
  for (const para of text.split(/\n\s*\n/)) {
    const paraStart = cursor;
    const paraEnd = paraStart + para.length;
    cursor = paraEnd + 2; // blank line

    let p = paraStart;
    while (p < paraEnd) {
      // Find the next sentence boundary.
      let boundaryEnd = -1;
      const tail = para.slice(p - paraStart);
      const re = /([.!?])(['"\u2019\u201d)\]]*)\s+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tail)) !== null) {
        const candidateEnd = p + m.index + m[0].length;
        // Skip abbreviations: check the token immediately before the terminator.
        const before = para.slice(0, p - paraStart + m.index);
        const last = before.match(/(\S+)$/)?.[1] ?? "";
        const stripped = last.replace(/[.,;:!?\u2019\u201d)\]]+$/, "").toLowerCase();
        if (ABBREVIATIONS.has(stripped)) continue;
        boundaryEnd = candidateEnd;
        break;
      }

      if (boundaryEnd === -1) {
        // No more boundaries → take the rest of the paragraph as the last sentence.
        if (p < paraEnd) {
          const rest = text.slice(p, paraEnd);
          if (rest.trim()) {
            addSentence(words, sentences, text, p, paraEnd);
          }
        }
        break;
      }

      addSentence(words, sentences, text, p, boundaryEnd);
      p = boundaryEnd;
    }
  }

  return { words, sentences };
}

function addSentence(
  words: Range[],
  sentences: Range[],
  text: string,
  start: number,
  end: number,
): void {
  sentences.push({ start, end });
  const slice = text.slice(start, end);
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(slice)) !== null) {
    const wordStart = start + m.index;
    const wordText = (m[1] ?? "") + (m[2] ?? "");
    if (!wordText) continue;
    words.push({ start: wordStart, end: wordStart + wordText.length });
  }
}