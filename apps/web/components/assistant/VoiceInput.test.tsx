/**
 * VoiceInput — Web Speech API mock + fallback test.
 *
 * Mirrors TESTING.md §2.10: when `SpeechRecognition` is missing the UI
 * shows a textarea fallback (Firefox desktop case). When it's present
 * (mocked) the transcript fires the `onTranscript` callback.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { VoiceInput, type SpeechRecognitionLike, type SpeechRecognitionCtor } from "./VoiceInput";

class MockRecognition implements SpeechRecognitionLike {
  continuous = true;
  interimResults = true;
  lang = "en-US";
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;
  start(): void {
    this.startCalls += 1;
  }
  stop(): void {
    this.stopCalls += 1;
    // Simulate end-of-utterance behavior so the component settles.
    setTimeout(() => this.onend?.(), 0);
  }
  emit(transcript: string, isFinal: boolean): void {
    this.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal,
          0: { transcript },
          length: 1,
        } as unknown as ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>,
      ],
    });
  }
}

function makeMockCtor(impl: { onCreate?: (r: MockRecognition) => void }): SpeechRecognitionCtor {
  return function () {
    const r = new MockRecognition();
    impl.onCreate?.(r);
    return r;
  } as unknown as SpeechRecognitionCtor;
}

describe("VoiceInput", () => {
  it("renders the textarea fallback when SpeechRecognition is unsupported", () => {
    const onTranscript = vi.fn();
    render(
      <VoiceInput onTranscript={onTranscript} speechRecognitionImpl={null} />,
    );
    expect(
      screen.getByText(/Voice input not supported in this browser/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type instead/i)).toBeInTheDocument();
  });

  it("transcripts via the fallback textarea", async () => {
    const onTranscript = vi.fn();
    render(<VoiceInput onTranscript={onTranscript} speechRecognitionImpl={null} />);
    const input = screen.getByPlaceholderText(/Type instead/i);
    fireEvent.change(input, { target: { value: "fallback text" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(onTranscript).toHaveBeenCalledWith("fallback text");
  });

  it("uses Web Speech API when available, finalizing on isFinal=true", async () => {
    let rec: MockRecognition | null = null;
    const ctor = makeMockCtor({ onCreate: (r) => (rec = r) });
    const onTranscript = vi.fn();
    render(<VoiceInput onTranscript={onTranscript} speechRecognitionImpl={ctor} />);
    fireEvent.click(screen.getByRole("button", { name: /Start listening/ }));
    await waitFor(() => expect(rec).not.toBeNull());
    expect(rec!.startCalls).toBe(1);
    rec!.emit("the quick brown fox", true);
    expect(onTranscript).toHaveBeenCalledWith("the quick brown fox");
  });

  it("shows interim transcripts while listening", async () => {
    let rec: MockRecognition | null = null;
    const ctor = makeMockCtor({ onCreate: (r) => (rec = r) });
    render(<VoiceInput onTranscript={vi.fn()} speechRecognitionImpl={ctor} />);
    fireEvent.click(screen.getByRole("button", { name: /Start listening/ }));
    await waitFor(() => expect(rec).not.toBeNull());
    rec!.emit("interim hello", false);
    // The DOM splits the label into two text nodes ("Listening: " + em
    // "interim hello"); query the em directly to keep the assertion
    // robust against whitespace.
    await waitFor(() => {
      expect(screen.getByText("interim hello")).toBeInTheDocument();
    });
  });

  it("transitions to stopped state when stop() is called", async () => {
    let rec: MockRecognition | null = null;
    const ctor = makeMockCtor({ onCreate: (r) => (rec = r) });
    render(<VoiceInput onTranscript={vi.fn()} speechRecognitionImpl={ctor} />);
    fireEvent.click(screen.getByRole("button", { name: /Start listening/ }));
    await waitFor(() => expect(rec).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Stop listening/ }));
    await waitFor(() => {
      expect(rec!.stopCalls).toBe(1);
    });
  });
});