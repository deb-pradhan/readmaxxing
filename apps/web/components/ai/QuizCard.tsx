"use client";

/**
 * QuizCard — single retrieval-practice question with 4 options.
 *
 * Per UI-UX.md §7: "Immediate green/red feedback. Explanation shown after
 * answer. No punishment styling. Tracks current attempt score; optimistic
 * submission via TanStack Query."
 *
 * Shaming is forbidden (UI-UX.md §8): the message on a wrong answer is
 * "Not quite — the answer is X" not "WRONG".
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@readmaxxing/ui";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceParagraph: number;
}

export interface QuizResponse {
  quizId: string;
  questions: QuizQuestion[];
  model: string;
  createdAt: string;
}

export interface QuizAttemptResponse {
  attemptId: string;
  score: number;
  total: number;
  percent: number;
}

export interface QuizCardProps {
  documentId: string;
  /** Called when the user wants to see the source paragraph of a question. */
  onJumpToParagraph?: (paragraphIndex: number) => void;
  className?: string;
  /** Override fetcher for tests. */
  fetchImpl?: typeof fetch;
}

export function QuizCard({
  documentId,
  onJumpToParagraph,
  className,
  fetchImpl,
}: QuizCardProps): React.JSX.Element {
  const f = fetchImpl ?? ((...args) => fetch(...args));
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Array<number | null>>([]);
  const [startTime] = React.useState(() => Date.now());

  const query = useQuery<QuizResponse>({
    queryKey: ["ai", "quiz", documentId],
    queryFn: async () => {
      const res = await f("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, count: 5 }),
      });
      if (!res.ok) {
        throw new Error(`quiz_failed: ${res.status}`);
      }
      return (await res.json()) as QuizResponse;
    },
    staleTime: 1000 * 60 * 10,
  });

  React.useEffect(() => {
    if (query.data && answers.length !== query.data.questions.length) {
      setAnswers(new Array(query.data.questions.length).fill(null));
    }
  }, [query.data, answers.length]);

  const submitMutation = useMutation<QuizAttemptResponse, Error, void>({
    mutationFn: async () => {
      if (!query.data) throw new Error("no_quiz");
      const res = await f("/api/ai/quiz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: query.data.quizId,
          answers: answers.map((a) => a ?? 0),
          durationMs: Date.now() - startTime,
        }),
      });
      if (!res.ok) {
        throw new Error(`attempt_failed: ${res.status}`);
      }
      return (await res.json()) as QuizAttemptResponse;
    },
  });

  if (query.isLoading) {
    return (
      <section
        className={cn(
          "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
          className,
        )}
        aria-busy
      >
        <h2 className="text-lg font-semibold">Quiz</h2>
        <p className="mt-4 text-sm text-ink-muted">Generating questions…</p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className={cn("rounded-lg border border-border-subtle bg-card p-5 shadow-sm", className)}>
        <h2 className="text-lg font-semibold">Quiz</h2>
        <p role="alert" className="mt-4 text-sm text-ink-muted">
          Couldn&apos;t generate a quiz — retry.
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-3 rounded-md border border-border-subtle px-3 py-1 text-sm hover:bg-card-muted"
        >
          Retry
        </button>
      </section>
    );
  }

  if (submitMutation.isSuccess && submitMutation.data) {
    const { score, total, percent } = submitMutation.data;
    return (
      <section
        className={cn(
          "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
          className,
        )}
        aria-live="polite"
      >
        <h2 className="text-lg font-semibold">Nice work — you scored {score}/{total}</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {percent >= 80
            ? "Strong recall — that's the comprehension habit paying off."
            : percent >= 50
              ? "Solid pass — review the explanations and try another."
              : "Worth a re-read — every quiz deepens the memory."}
        </p>
        <button
          type="button"
          onClick={() => {
            setCurrentIdx(0);
            setAnswers(new Array(query.data!.questions.length).fill(null));
            submitMutation.reset();
          }}
          className="mt-4 inline-flex h-10 items-center rounded-md bg-coral-bg px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:shadow-focus"
        >
          Try again
        </button>
      </section>
    );
  }

  const questions = query.data.questions;
  const q = questions[currentIdx];
  if (!q) {
    return (
      <section className={cn("rounded-lg border border-border-subtle bg-card p-5 shadow-sm", className)}>
        <h2 className="text-lg font-semibold">Quiz</h2>
        <p className="mt-2 text-sm text-ink-muted">No questions to show.</p>
      </section>
    );
  }

  const selected = answers[currentIdx] ?? null;
  const answered = selected !== null;
  const isCorrect = answered && selected === q.correctIndex;

  return (
    <section
      aria-label={`Question ${currentIdx + 1} of ${questions.length}`}
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quiz</h2>
        <span className="text-xs tabular text-ink-muted">
          {currentIdx + 1} / {questions.length}
        </span>
      </header>
      <p className="mt-4 text-base font-medium text-ink">{q.question}</p>
      <ul className="mt-3 space-y-2" role="radiogroup" aria-label="Answer choices">
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = answered && i === q.correctIndex;
          const showWrong = answered && isSelected && i !== q.correctIndex;
          return (
            <li key={i}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={answered}
                onClick={() =>
                  setAnswers((prev) => {
                    const next = [...prev];
                    next[currentIdx] = i;
                    return next;
                  })
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors duration-fast ease-out",
                  "focus-visible:outline-none focus-visible:shadow-focus",
                  showCorrect
                    ? "border-success bg-success-soft text-ink"
                    : showWrong
                      ? "border-warning bg-warning-soft text-ink"
                      : isSelected
                        ? "border-coral-bg bg-coral-soft text-ink"
                        : "border-border-subtle bg-canvas text-ink hover:bg-card-muted",
                  answered ? "cursor-default" : "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    showCorrect
                      ? "border-success bg-success text-white"
                      : showWrong
                        ? "border-warning bg-warning text-white"
                        : isSelected
                          ? "border-coral-bg bg-coral-bg text-white"
                          : "border-border-subtle text-ink-muted",
                  )}
                  aria-hidden
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div
          aria-live="polite"
          className={cn(
            "mt-4 rounded-md border p-3 text-sm",
            isCorrect
              ? "border-success bg-success-soft text-ink"
              : "border-warning bg-warning-soft text-ink",
          )}
        >
          <p className="font-medium">
            {isCorrect
              ? "Correct — nice recall."
              : `Not quite — it's ${q.options[q.correctIndex]}.`}
          </p>
          {q.explanation ? (
            <p className="mt-1 text-ink-muted">{q.explanation}</p>
          ) : null}
          {q.sourceParagraph >= 0 ? (
            <button
              type="button"
              onClick={() => onJumpToParagraph?.(q.sourceParagraph)}
              className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
            >
              Jump to paragraph {q.sourceParagraph + 1}
            </button>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          className="rounded-md border border-border-subtle px-3 py-1 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        {currentIdx === questions.length - 1 ? (
          <button
            type="button"
            disabled={answers.some((a) => a === null) || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="rounded-md bg-coral-bg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!answered}
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="rounded-md bg-coral-bg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Next
          </button>
        )}
      </footer>
    </section>
  );
}
