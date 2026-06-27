/**
 * AskChat — quick chip submission + streaming render test.
 *
 * Verifies:
 *   - Quick chip click submits the question
 *   - Streaming answer renders progressively (deltas accumulate)
 *   - Citations appear once the stream ends
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { AskChat } from "./AskChat";

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

  it("invokes onJumpToParagraph when a citation is clicked", async () => {
    const onJump = vi.fn();
    render(
      <AskChat
        documentId="doc1"
        onJumpToParagraph={onJump}
        fetchImpl={fetchOkStream([
          { delta: "Answer." },
          { done: true, citations: [{ paragraphIndex: 5, sentenceIndex: 2 }], model: "x" },
        ])}
      />,
    );
    fireEvent.click(screen.getByText("Explain like I'm 5"));
    const cite = await screen.findByText(/¶6/);
    fireEvent.click(cite);
    expect(onJump).toHaveBeenCalledWith(5);
  });
});
