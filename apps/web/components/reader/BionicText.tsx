"use client";

/**
 * BionicText — opt-in fixation highlighting.
 *
 * Per DESIGN-SYSTEM §5: bold the first 40% (default) of letters in
 * each word to create saccade anchors. Opt-in only; offer, never
 * default. The fixation percent + opacity are configurable.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface BionicTextProps {
  /** Word to render with fixation highlighting. */
  word: string;
  /** Fixation percentage (0–100). Defaults to 40. */
  fixationPercent?: number;
  /** Opacity of the bold (lead) portion. Defaults to 1. */
  opacity?: number;
  className?: string;
}

function bionicSplit(
  word: string,
  fixation: number,
): { lead: string; rest: string } {
  if (word.length <= 1) return { lead: word, rest: "" };
  const cut = Math.max(1, Math.ceil(word.length * (fixation / 100)));
  return { lead: word.slice(0, cut), rest: word.slice(cut) };
}

export function BionicText({
  word,
  fixationPercent = 40,
  opacity = 1,
  className,
}: BionicTextProps): React.JSX.Element {
  const { lead, rest } = bionicSplit(word, fixationPercent);
  return (
    <span className={cn(className)}>
      <strong
        className="font-bold"
        style={{ opacity }}
        data-bionic-lead
      >
        {lead}
      </strong>
      <span data-bionic-rest>{rest}</span>
    </span>
  );
}