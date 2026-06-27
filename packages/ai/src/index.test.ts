/**
 * @readmaxxing/ai — prompt-helper unit tests.
 *
 * Verifies the citation rule ([cite:p:s]) is enforced and that the response
 * parsers turn raw model output into the BFF route-contract shape.
 */

import { describe, it, expect } from "vitest";
import {
  CITE_RE,
  buildAskPrompt,
  buildFillerPrompt,
  buildQuizPrompt,
  buildRecapPrompt,
  buildSummaryPrompt,
  countCitations,
  parseFillerResult,
  parseQuiz,
  parseSummary,
  validateCitations,
} from "./index";

describe("citation rule", () => {
  it("every prompt embeds the citation rule text", () => {
    const all = [
      buildSummaryPrompt({ documentText: "abc" }).system,
      buildQuizPrompt({ documentText: "abc" }).system,
      buildRecapPrompt({
        documentText: "abc",
        lastParagraphIndex: 0,
        lastSentenceIndex: 0,
      }).system,
      buildAskPrompt({ documentText: "abc", question: "why" }).system,
      buildFillerPrompt({ documentText: "abc" }).system,
    ];
    for (const s of all) {
      expect(s).toMatch(/\[cite:paragraphIndex:sentenceIndex\]/);
    }
  });

  it("CITE_RE matches zero-indexed paragraph/sentence pairs", () => {
    const text = "Hello [cite:0:0] world [cite:12:3].";
    const matches = [...text.matchAll(new RegExp(CITE_RE.source, "g"))];
    expect(matches).toHaveLength(2);
    expect(matches[0]?.[1]).toBe("0");
    expect(matches[0]?.[2]).toBe("0");
    expect(matches[1]?.[1]).toBe("12");
    expect(matches[1]?.[2]).toBe("3");
  });

  it("countCitations returns 0 for text with no tags", () => {
    expect(countCitations("no citations here")).toBe(0);
  });

  it("validateCitations flags long prose with zero citations", () => {
    const prose =
      "This is a reasonably long paragraph that should have at least one citation but doesn't.";
    const result = validateCitations(prose);
    expect(result.missing).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.count).toBe(0);
  });

  it("validateCitations passes when citations are present", () => {
    const result = validateCitations(
      "According to the source [cite:2:1], the answer is 42.",
    );
    expect(result.ok).toBe(true);
    expect(result.missing).toBe(false);
    expect(result.count).toBe(1);
    expect(result.anchors[0]).toEqual({ paragraphIndex: 2, sentenceIndex: 1 });
  });

  it("validateCitations treats short responses as ok even without citations", () => {
    const result = validateCitations("hi");
    expect(result.missing).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("prompts do not include the user's private document text in the system prompt", () => {
    // Document text should live in the user prompt, not the system prompt —
    // prevents accidental leakage of the system message to logs that capture
    // only the system field.
    const secretText = "PRIVATE_CONTENT_THAT_SHOULD_NEVER_BE_IN_SYSTEM";
    const sum = buildSummaryPrompt({ documentText: secretText });
    expect(sum.system).not.toContain(secretText);
    expect(sum.prompt).toContain(secretText);
  });
});

describe("parseSummary", () => {
  it("parses TL;DR / bullets / detailed sections", () => {
    const raw = `TL;DR: A short, sharp one-sentence headline.
Key points:
- First important point.
- Second important point [cite:1:0].
- Third point.

Detailed: A longer paragraph that elaborates on the bullet points above [cite:2:0].`;
    const parsed = parseSummary(raw);
    expect(parsed.tldr).toMatch(/short, sharp one-sentence/);
    expect(parsed.bullets).toHaveLength(3);
    expect(parsed.bullets[0]).toBe("First important point.");
    expect(parsed.detailed).toMatch(/longer paragraph/);
    expect(parsed.citations).toEqual([
      { paragraphIndex: 1, sentenceIndex: 0 },
      { paragraphIndex: 2, sentenceIndex: 0 },
    ]);
  });

  it("falls back to the whole text when no sections are present", () => {
    const parsed = parseSummary("Just one block of text, no headers.");
    expect(parsed.tldr).toBe("Just one block of text, no headers.");
    expect(parsed.bullets).toEqual([]);
  });

  it("strips code fences", () => {
    const parsed = parseSummary("```\nTL;DR: inside a fence\n```");
    expect(parsed.tldr).toBe("inside a fence");
  });
});

describe("parseQuiz", () => {
  it("maps the prompt-helper JSON shape to the BFF route contract", () => {
    const parsed = parseQuiz({
      questions: [
        {
          prompt: "What color is the sky?",
          choices: ["green", "blue", "red", "yellow"],
          answerIndex: 1,
          citation: "The sky appears blue [cite:3:2].",
        },
      ],
    });
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]?.question).toBe("What color is the sky?");
    expect(parsed.questions[0]?.options).toEqual([
      "green",
      "blue",
      "red",
      "yellow",
    ]);
    expect(parsed.questions[0]?.correctIndex).toBe(1);
    expect(parsed.questions[0]?.explanation).toBe("The sky appears blue .");
    expect(parsed.questions[0]?.sourceParagraph).toBe(3);
  });

  it("drops malformed questions (wrong number of choices, etc)", () => {
    const parsed = parseQuiz({
      questions: [
        { prompt: "ok", choices: ["a", "b"], answerIndex: 0, citation: "x" },
        {
          prompt: "valid",
          choices: ["a", "b", "c", "d"],
          answerIndex: 0,
          citation: "y",
        },
        {
          prompt: "bad index",
          choices: ["a", "b", "c", "d"],
          answerIndex: 7,
          citation: "z",
        },
      ],
    });
    expect(parsed.questions).toHaveLength(1);
  });
});

describe("parseFillerResult", () => {
  it("validates the LLM JSON and drops malformed entries", () => {
    const parsed = parseFillerResult({
      fillers: [
        { paragraphIndex: 0, sentenceIndex: 0, reason: "throat-clearing" },
        { paragraphIndex: 2, sentenceIndex: 1, reason: "transition" },
        { paragraphIndex: "oops", sentenceIndex: 0, reason: "bad" },
        null,
      ],
    });
    expect(parsed).toEqual([
      { paragraphIndex: 0, sentenceIndex: 0, reason: "throat-clearing" },
      { paragraphIndex: 2, sentenceIndex: 1, reason: "transition" },
    ]);
  });
});
