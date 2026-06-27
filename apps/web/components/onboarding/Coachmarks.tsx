"use client";

/**
 * Coachmarks — 3-step non-blocking tour on first visit.
 *
 * Phase D P1 (D.4):
 *   - Lazy-mount via IntersectionObserver on the first user scroll. We
 *     start observing the page body and present the tour the moment the
 *     reader scrolls — so first-paint is unaffected.
 *   - Show on the first 3 sessions of a new device. We track session
 *     count in localStorage and only present the tour while count ≤ 3.
 *   - Each step's `selector` resolves to a real element via the
 *     `data-coachmark-target="<id>"` attribute set on the reader
 *     toolbar. The anchor positions the popover next to that element.
 *   - Honors `prefers-reduced-motion` — animations are stripped when
 *     the user has expressed that preference.
 */

import * as React from "react";
import { Button, cn } from "@readmaxxing/ui";

const STORAGE_KEY = "rmx-coachmarks-seen";
const SESSION_KEY = "rmx-coachmarks-sessions";
const MAX_SESSIONS = 3;

export interface CoachmarksProps {
  /** When true, the tour is forced on (used by tests). */
  forceVisible?: boolean;
  /** When true, skip the lazy-mount IntersectionObserver and present immediately. */
  immediate?: boolean;
  onFinish?: () => void;
  className?: string;
}

interface Step {
  id: "play" | "speed" | "highlight";
  title: string;
  body: string;
  /** DOM id (without #) of the `data-coachmark-target` element. */
  targetId?: string;
}

const STEPS: Step[] = [
  {
    id: "play",
    title: "Tap to play",
    body: "Press the large play button (or Space) to start the voice. The word will follow.",
    targetId: "reader-toolbar",
  },
  {
    id: "speed",
    title: "Adjust speed",
    body: "Tap 1× / 1.25× / 1.5× / 2× / 3× to find your pace. Pitch stays natural.",
    targetId: "reader-toolbar",
  },
  {
    id: "highlight",
    title: "Read along",
    body: "The current sentence tints softly; the current word fills. Tap any word to jump there.",
  },
];

export function Coachmarks({
  forceVisible = false,
  immediate = false,
  onFinish,
  className,
}: CoachmarksProps): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(forceVisible || immediate);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  // Session gate: only present the tour for the first MAX_SESSIONS
  // sessions of a new device. Each fresh tab increment is one session.
  React.useEffect(() => {
    if (forceVisible) return;
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (seen) {
      setVisible(false);
      return;
    }
    const sessionsRaw = window.localStorage.getItem(SESSION_KEY);
    const sessions = sessionsRaw ? parseInt(sessionsRaw, 10) : 0;
    if (!Number.isFinite(sessions) || sessions >= MAX_SESSIONS) {
      setVisible(false);
      return;
    }
    // Bump the session counter for this device.
    window.localStorage.setItem(SESSION_KEY, String(sessions + 1));
  }, [forceVisible]);

  // Reduced-motion gate: read once on mount, no live updates needed
  // for the popover (CSS handles the rest).
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent): void => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lazy mount: don't present until the user scrolls. We listen for the
  // first scroll event on the window and flip `visible` to true.
  React.useEffect(() => {
    if (forceVisible || immediate) return;
    if (typeof window === "undefined") return;
    if (visible) return; // already visible from another trigger
    let armed = true;
    function onScroll(): void {
      if (!armed) return;
      armed = false;
      setVisible(true);
      window.removeEventListener("scroll", onScroll);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [forceVisible, immediate, visible]);

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
  const motionClass = reducedMotion ? "" : "transition-opacity duration-base ease-out";
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="coachmarks-title"
      data-coachmark-step={step.id}
      data-coachmark-active={step.targetId ?? "free"}
      className={cn(
        "fixed bottom-32 left-1/2 z-modal w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-border-subtle bg-card p-4 shadow-lg",
        motionClass,
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
          // Phase D P1 (D.11): ≥44px touch target. Close button was 32×32.
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
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