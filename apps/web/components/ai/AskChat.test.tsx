/**
 * AskChat — quick chip submission + streaming render test.
 *
 * Verifies:
 *   - Quick chip click submits the question
 *   - Streaming answer renders progressively (deltas accumulate)
 *   - Citations appear once the stream ends
 *   - Audit C4 (Phase C P0): `[cite:p:s]` markup is tokenized into
 *     `<CitationPill>` instances — never raw `[cite:0:2]` text reaches the
 *     user. The terminal frame carries `prose` which the client uses as the
 *     canonical renderable string.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { AskChat, tokenizeProse } from "./AskChat";

function ndjsonStream(lines: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      }
      controller.close();
    },
  });
}

function fetchOkStream(lines: object[]): typeof fetch {
  return async () =>
    new Response(ndjsonStream(lines), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
}

describe("AskChat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the quick chips", async () => {
    render(
      <AskChat
        documentId="doc1"
        fetchImpl={fetchOkStream([
          { delta: "Hello there" },
          { done: true, citations: [{ paragraphIndex: 0, sentenceIndex: 0 }], model: "x" },
        ])}
      />,
    );
    expect(screen.getByText("Explain like I'm 5")).toBeInTheDocument();
    expect(screen.getByText("Give me an example")).toBeInTheDocument();
    expect(screen.getByText("Summarize from here")).toBeInTheDocument();
  });

  it("submits a question when a quick chip is clicked", async () => {
    const captured: { url: string; body: unknown } = { url: "", body: null };
    const fetchImpl: typeof fetch = async (input, init) => {
      captured.url = String(input);
      captured.body = JSON.parse(init?.body as string);
      return new Response(
        ndjsonStream([
          { delta: "It's a doc." },
          { done: true, citations: [], model: "x" },
        ]),
        { status: 200 },
      );
    };
    render(<AskChat documentId="doc1" fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByText("Explain like I'm 5"));
    await waitFor(() => {
      expect(captured.url).toBe("/api/ai/ask");
      expect((captured.body as { question: string }).question).toMatch(/5-year-old/i);
    });
  });

  it("accumulates streaming deltas into a single assistant message", async () => {
    render(
      <AskChat
        documentId="doc1"
        fetchImpl={fetchOkStream([
          { delta: "The " },
          { delta: "sky " },
          { delta: "is " },
          { delta: "blue." },
          { done: true, citations: [{ paragraphIndex: 0, sentenceIndex: 0 }], model: "x" },
        ])}
      />,
    );
    fireEvent.click(screen.getByText("Explain like I'm 5"));
    const final = await screen.findByText("The sky is blue.");
    expect(final).toBeInTheDocument();
    // Citations appear after the stream ends.
    const citeButton = await screen.findByText(/¶1/);
    expect(citeButton).toBeInTheDocument();
  });

  it("invokes onJumpToParagraph when a citation pill is clicked", async () => {
    const onJump = vi.fn();
    render(
      <AskChat
        documentId="doc1"
        onJumpToParagraph={onJump}
        fetchImpl={fetchOkStream([
          { delta: "Answer." },
          {
            done: true,
            citations: [{ paragraphIndex: 5, sentenceIndex: 2 }],
            prose: "Answer.",
            model: "x",
          },
        ])}
      />,
    );
    fireEvent.click(screen.getByText("Explain like I'm 5"));
    const cite = await screen.findByText(/¶6/);
    fireEvent.click(cite);
    expect(onJump).toHaveBeenCalledWith(5);
  });

  it("tokenizes [cite:p:s] placeholders into CitationPills (audit C4)", async () => {
    const onJump = vi.fn();
    render(
      <AskChat
        documentId="doc1"
        onJumpToParagraph={onJump}
        fetchImpl={fetchOkStream([
          { delta: "The " },
          { delta: "sky " },
          { delta: "is " },
          { delta: "blue" },
          {
            done: true,
            citations: [
              { paragraphIndex: 0, sentenceIndex: 0 },
              { paragraphIndex: 2, sentenceIndex: 1 },
            ],
            prose: "The sky is blue [cite:0:0] and the grass is green [cite:2:1].",
            model: "x",
          },
        ])}
      />,
    );
    fireEvent.click(screen.getByText("Explain like I'm 5"));

    // The raw `[cite:0:2]` text must NOT appear in the rendered DOM.
    await waitFor(() => {
      expect(screen.queryByText(/\[cite:/)).not.toBeInTheDocument();
    });

    // Two CitationPills render — one per paragraph. Their aria-label surfaces
    // the (1-indexed) paragraph number for screen-reader users.
    const pills = await screen.findAllByRole("button", { name: /Citation: paragraph/i });
    expect(pills.length).toBe(2);

    // Click the second pill and verify it routes to the right paragraph.
    fireEvent.click(pills[1]!);
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("renders a paragraph-less answer as plain text (no pills, no markup)", async () => {
    render(
      <AskChat
        documentId="doc1"
        fetchImpl={fetchOkStream([
          { delta: "Just a plain answer." },
          { done: true, citations: [], prose: "Just a plain answer.", model: "x" },
        ])}
      />,
    );
    fireEvent.click(screen.getByText("Explain like I'm 5"));
    const final = await screen.findByText("Just a plain answer.");
    expect(final).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Citation:/ })).not.toBeInTheDocument();
  });
});

describe("tokenizeProse (audit C4 unit test)", () => {
  it("returns an empty array for empty prose", () => {
    expect(tokenizeProse("")).toHaveLength(0);
  });

  it("returns a single text fragment when there are no citations", () => {
    const nodes = tokenizeProse("Just plain text.");
    expect(nodes).toHaveLength(1);
    // Each tokenized node is either a React.Fragment (for plain text) or
    // a <CitationPill>. We verify via React's element shape: the single
    // node is a Fragment whose children is the verbatim string.
    const fragment = nodes[0] as React.ReactElement<{ children: string }>;
    expect(fragment.type).toBe(React.Fragment);
    expect(fragment.props.children).toBe("Just plain text.");
  });

  it("emits a CitationPill for each [cite:p:s] placeholder", () => {
    const nodes = tokenizeProse("Before [cite:0:0] middle [cite:1:2] after.");
    // Tokens alternate: text, pill, text, pill, text → 5 nodes total.
    expect(nodes).toHaveLength(5);
    const pills = nodes.filter(
      (n): n is React.ReactElement<{ paragraphIndex: number; sentenceIndex?: number }> =>
        React.isValidElement(n) &&
        typeof n.type === "object" &&
        (n.type as { displayName?: string }).displayName === "CitationPill",
    );
    expect(pills.length).toBe(2);
  });

  it("respects paragraph/sentence indices from the placeholder", () => {
    const nodes = tokenizeProse("a [cite:7:3] b");
    const pill = nodes.find(
      (n): n is React.ReactElement<{ paragraphIndex: number; sentenceIndex?: number }> =>
        React.isValidElement(n) &&
        typeof n.type === "object" &&
        (n.type as { displayName?: string }).displayName === "CitationPill",
    );
    expect(pill).toBeDefined();
    expect(pill!.props.paragraphIndex).toBe(7);
    expect(pill!.props.sentenceIndex).toBe(3);
  });
});
