/**
 * QuizCard — answer feedback rendering test.
 *
 * Verifies the immediate green/red feedback per UI-UX.md §7:
 *   - correct answer shows the success styling
 *   - wrong answer shows the warning styling + "Not quite" copy (no shame)
 *   - explanation is shown after the answer
 *   - jumping to the source paragraph triggers the callback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuizCard } from "./QuizCard";

const SAMPLE_QUIZ = {
  quizId: "q1",
  model: "openai/gpt-4o-mini",
  createdAt: new Date().toISOString(),
  questions: [
    {
      question: "What color is the sky on a clear day?",
      options: ["red", "blue", "green", "yellow"],
      correctIndex: 1,
      explanation: "Atmospheric scattering makes the sky appear blue.",
      sourceParagraph: 0,
    },
  ],
};

function wrapper(): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <QuizCard
        documentId="doc1"
        fetchImpl={async () => new Response(JSON.stringify(SAMPLE_QUIZ), { status: 200 })}
      />
    </QueryClientProvider>
  );
}

describe("QuizCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a question and the 4 choices", async () => {
    render(wrapper());
    const prompt = await screen.findByText(/What color is the sky/i);
    expect(prompt).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /red/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /blue/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /green/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /yellow/i })).toBeInTheDocument();
  });

  it("shows positive feedback on a correct answer", async () => {
    render(wrapper());
    const correctChoice = await screen.findByRole("radio", { name: /blue/i });
    fireEvent.click(correctChoice);
    expect(await screen.findByText(/Correct/i)).toBeInTheDocument();
    expect(screen.queryByText(/Not quite/i)).toBeNull();
    expect(screen.getByText(/Atmospheric scattering/i)).toBeInTheDocument();
  });

  it("shows non-shaming copy on a wrong answer", async () => {
    render(wrapper());
    const wrongChoice = await screen.findByRole("radio", { name: /red/i });
    fireEvent.click(wrongChoice);
    const message = await screen.findByText(/Not quite/i);
    expect(message).toBeInTheDocument();
    expect(message.textContent).toContain("blue");
    // No shame styling — copy is "Not quite", not "WRONG".
    expect(message.textContent).not.toMatch(/^WRONG/);
  });

  it("invokes onJumpToParagraph when the source link is clicked", async () => {
    const onJump = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={client}>
        <QuizCard
          documentId="doc1"
          onJumpToParagraph={onJump}
          fetchImpl={async () => new Response(JSON.stringify(SAMPLE_QUIZ), { status: 200 })}
        />
      </QueryClientProvider>,
    );
    const correct = await screen.findByRole("radio", { name: /blue/i });
    fireEvent.click(correct);
    const link = await screen.findByText(/Jump to paragraph 1/i);
    fireEvent.click(link);
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it("disables choices after an answer", async () => {
    render(wrapper());
    const correct = await screen.findByRole("radio", { name: /blue/i });
    fireEvent.click(correct);
    await waitFor(() => {
      const red = screen.getByRole("radio", { name: /red/i });
      expect(red).toBeDisabled();
    });
  });
});
