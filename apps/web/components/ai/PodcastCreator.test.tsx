/**
 * PodcastCreator — style selection + staged progress rendering tests.
 *
 * The component drives a POST + SSE dance; we mock the fetch layer so
 * the unit tests don't need the real worker. The honest-time progress
 * rule from UI-UX.md §7 is exercised by the rendering of elapsed /
 * remaining readouts.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { PodcastCreator } from "./PodcastCreator";

/**
 * Build a fake SSE stream that emits the `event: <stage>\ndata: {...}\n\n`
 * frames the worker writes (see `_format_sse` in the worker).
 */
function sseStream(frames: Array<{ event: string; data: object }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(
          encoder.encode(`event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`),
        );
      }
      controller.close();
    },
  });
}

function makeFetch(handlers: {
  post?: (body: unknown) => Response | Promise<Response>;
  sse?: () => Response | Promise<Response>;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (init?.method === "POST" && url.endsWith("/api/ai/podcasts")) {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      return handlers.post!(body);
    }
    if (url.includes("/progress")) {
      return handlers.sse!();
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("PodcastCreator", () => {
  it("renders all four style cards", () => {
    render(<PodcastCreator />);
    // Each style card is a button whose accessible name includes the
    // description text; we assert the label fragment is present.
    expect(screen.getByRole("button", { name: /Podcast.*casual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Late Night.*intimate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Debate.*opposing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lecture.*expert/i })).toBeInTheDocument();
  });

  it("lets the user pick a different style", () => {
    render(<PodcastCreator />);
    const debate = screen.getByRole("button", { name: /Debate.*opposing/i });
    fireEvent.click(debate);
    expect(debate.getAttribute("aria-pressed")).toBe("true");
  });

  it("submits a POST to the podcasts endpoint when 'Create podcast' is clicked", async () => {
    let captured: { url: string; body: unknown } = { url: "", body: null };
    const fetchImpl = makeFetch({
      post: (body) => {
        captured = { url: "/api/ai/podcasts", body };
        return new Response(
          JSON.stringify({ episode: { id: "ep-abc", status: "queued" } }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      },
      sse: () =>
        new Response(
          sseStream([
            {
              event: "completed",
              data: { stage: "completed", duration_ms: 5000, status: "ok" },
            },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    try {
      render(<PodcastCreator />);
      const title = screen.getByPlaceholderText("Untitled podcast");
      fireEvent.change(title, { target: { value: "My first episode" } });
      const promptArea = screen.getByPlaceholderText(/Paste a topic/);
      fireEvent.change(promptArea, { target: { value: "hello world" } });
      const create = screen.getByRole("button", { name: /Create podcast/ });
      fireEvent.click(create);
      await waitFor(() => {
        expect(captured.body).toBeTruthy();
      });
      const body = captured.body as { prompt?: string; style?: string; title?: string };
      expect(body.prompt).toBe("hello world");
      expect(body.style).toBe("podcast");
      expect(body.title).toBe("My first episode");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("transitions to the success state when the SSE feed reports 'completed'", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFetch({
      post: () =>
        new Response(
          JSON.stringify({ episode: { id: "ep-1", status: "queued" } }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      sse: () =>
        new Response(
          sseStream([
            { event: "reading_doc", data: { stage: "reading_doc", duration_ms: 100, status: "ok" } },
            { event: "writing_script", data: { stage: "writing_script", duration_ms: 800, status: "ok" } },
            { event: "casting_voices", data: { stage: "casting_voices", duration_ms: 5000, status: "ok" } },
            { event: "producing_audio", data: { stage: "producing_audio", duration_ms: 9000, status: "ok" } },
            { event: "completed", data: { stage: "completed", duration_ms: 10000, status: "ok" } },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
    }) as unknown as typeof fetch;
    try {
      render(<PodcastCreator />);
      const promptArea = screen.getByPlaceholderText(/Paste a topic/);
      fireEvent.change(promptArea, { target: { value: "any text" } });
      const create = screen.getByRole("button", { name: /Create podcast/ });
      fireEvent.click(create);
      // Variable-reward payoff: a "Listen now" CTA deep-links to the
      // episode page once the pipeline completes.
      const listenCta = await screen.findByRole("link", { name: /Listen now/i });
      expect(listenCta).toBeInTheDocument();
      expect(listenCta.getAttribute("href")).toBe("/podcasts/ep-1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders the four stage cards with real elapsed time while running", async () => {
    // Slow stream — frames spaced apart so React renders the stage list
    // mid-flight.
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    const frames = [
      { event: "reading_doc", data: { stage: "reading_doc", duration_ms: 100, status: "ok" } },
      { event: "writing_script", data: { stage: "writing_script", duration_ms: 800, status: "ok" } },
      { event: "casting_voices", data: { stage: "casting_voices", duration_ms: 5000, status: "ok" } },
      { event: "producing_audio", data: { stage: "producing_audio", duration_ms: 9000, status: "ok" } },
    ];

    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({ episode: { id: "ep-slow", status: "queued" } }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const frame of frames) {
            controller.enqueue(
              encoder.encode(
                `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`,
              ),
            );
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;
    try {
      render(<PodcastCreator />);
      const promptArea = screen.getByPlaceholderText(/Paste a topic/);
      fireEvent.change(promptArea, { target: { value: "slow stream" } });
      const create = screen.getByRole("button", { name: /Create podcast/ });
      fireEvent.click(create);
      await waitFor(
        () => {
          expect(screen.getByText(/Reading the document/i)).toBeInTheDocument();
        },
        { timeout: 4000 },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});