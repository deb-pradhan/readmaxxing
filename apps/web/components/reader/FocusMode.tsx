"use client";

/**
 * FocusMode — paragraph-dimming overlay for ADHD-friendly reading.
 *
 * Per DESIGN-SYSTEM §5: dims non-current paragraphs to ~30% opacity
 * when active. The dimming is handled inside `KaraokeHighlighter`.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface FocusModeProps {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function FocusMode({
  active,
  onToggle,
  className,
}: FocusModeProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium",
        "transition-colors duration-base ease-out focus-visible:outline-none focus-visible:shadow-focus",
        active ? "bg-coral-bg text-white" : "text-ink hover:bg-card-muted",
        className,
      )}
    >
      <span aria-hidden>{active ? "◉" : "◌"}</span>
      <span>Focus {active ? "on" : "off"}</span>
    </button>
  );
}