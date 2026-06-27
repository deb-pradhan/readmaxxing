"use client";

/**
 * Coachmarks — 3-step non-blocking tour on first visit.
 */

import * as React from "react";
import { Button, cn } from "@readmaxxing/ui";

const STORAGE_KEY = "rmx-coachmarks-seen";

export interface CoachmarksProps {
  /** When false, the tour is skipped (used by tests). */
  forceVisible?: boolean;
  onFinish?: () => void;
  className?: string;
}

interface Step {
  id: "play" | "speed" | "highlight";
  title: string;
  body: string;
  selector?: string;
}

const STEPS: Step[] = [
  {
    id: "play",
    title: "Tap to play",
    body: "Press the large play button (or Space) to start the voice. The word will follow.",
  },
  {
    id: "speed",
    title: "Adjust speed",
    body: "Tap 1× / 1.25× / 1.5× / 2× / 3× to find your pace. Pitch stays natural.",
  },
  {
    id: "highlight",
    title: "Read along",
    body: "The current sentence tints softly; the current word fills. Tap any word to jump there.",
  },
];

export function Coachmarks({
  forceVisible = false,
  onFinish,
  className,
}: CoachmarksProps): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      return;
    }
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, [forceVisible]);

  function dismiss(persist: boolean): void {
    setVisible(false);
    if (persist && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    onFinish?.();
  }

  function next(): void {
    if (stepIndex + 1 >= STEPS.length) {
      dismiss(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  if (!visible) return null;
  const step = STEPS[stepIndex]!;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="coachmarks-title"
      className={cn(
        "fixed bottom-32 left-1/2 z-modal w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-border-subtle bg-card p-4 shadow-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h2 id="coachmarks-title" className="mt-1 text-lg font-semibold text-ink">
            {step.title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Skip tour"
          onClick={() => dismiss(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => dismiss(true)}
          className="text-sm text-ink-muted hover:underline focus-visible:outline-none focus-visible:shadow-focus"
        >
          Skip tour
        </button>
        <Button type="button" variant="primary" size="md" onClick={next}>
          {stepIndex + 1 >= STEPS.length ? "Got it" : "Next"}
        </Button>
      </div>
    </div>
  );
}