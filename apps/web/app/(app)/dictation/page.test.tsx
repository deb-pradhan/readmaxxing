/**
 * /dictation — page render + word-count assertions.
 *
 * The page is a Client Component that wires the existing VoiceInput
 * (lazy-imported with `dynamic({ ssr: false })`) to a textarea + diff
 * view. We test the static parts (heading, editor, word count) without
 * touching the network — the diff flow is covered by the route test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock the VoiceInput component so we don't pull the Web Speech API into jsdom.
vi.mock("@/components/assistant/VoiceInput", () => ({
  VoiceInput: ({ onTranscript }: { onTranscript: (text: string) => void }) => (
    <button data-testid="mock-mic" onClick={() => onTranscript("Hello world")}>
      Mock mic
    </button>
  ),
}));

import DictationPage from "./page";

describe("/dictation page", () => {
  beforeEach(() => {
    // Mock fetch so the cleanup call doesn't actually hit the BFF.
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ cleaned: "Hello world", diff: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;
  });

  it("renders the editor and word count", () => {
    render(<DictationPage />);
    expect(screen.getByRole("heading", { name: /voice typing/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dictation transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/0 words/)).toBeInTheDocument();
  });

  it("updates the word count when the editor changes", () => {
    render(<DictationPage />);
    const editor = screen.getByLabelText(/dictation transcript/i) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "one two three four" } });
    expect(screen.getByText(/4 words/)).toBeInTheDocument();
  });

  it("shows a reading-time estimate", () => {
    render(<DictationPage />);
    const editor = screen.getByLabelText(/dictation transcript/i) as HTMLTextAreaElement;
    const fiveMinText = Array.from({ length: 155 * 5 }, () => "word").join(" ");
    fireEvent.change(editor, { target: { value: fiveMinText } });
    expect(screen.getByText(/5 min read/)).toBeInTheDocument();
  });

  it("appends a transcript when the mic fires", () => {
    render(<DictationPage />);
    const mic = screen.getByTestId("mock-mic");
    fireEvent.click(mic);
    const editor = screen.getByLabelText(/dictation transcript/i) as HTMLTextAreaElement;
    expect(editor.value).toBe("Hello world");
  });

  it("triggers cleanup when the button is clicked", async () => {
    render(<DictationPage />);
    const editor = screen.getByLabelText(/dictation transcript/i) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "um hello uh world" } });
    const cleanupBtn = screen.getByRole("button", { name: /clean up grammar/i });
    await act(async () => {
      fireEvent.click(cleanupBtn);
    });
    // After the mocked fetch resolves, the diff panel renders the heading.
    expect(await screen.findByText(/suggested cleanup/i)).toBeInTheDocument();
  });
});
