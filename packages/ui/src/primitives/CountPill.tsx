import * as React from "react";
import { cn } from "../cn";

export type CountPillTone = "neutral" | "accent" | "muted";

export interface CountPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The count to render. Numbers are formatted with `tabular-nums`; strings pass through. */
  count: number | string;
  /** Optional label rendered after the count (e.g. "tracks", "words"). */
  label?: string;
  /** Visual tone — controls the numeral color. */
  tone?: CountPillTone;
}

/**
 * CountPill — mono numeral + 0.55em superscript badge (DESIGN-SYSTEM §25.2 + §25.8).
 *
 * Used on filter chips, leaderboard rows, hero numbers ("Featured¹²",
 * "Total 124"). The mono numeral reads as instrument-grade; the superscript
 * keeps the count tied to its label without crowding it.
 */
export const CountPill = React.forwardRef<HTMLSpanElement, CountPillProps>(
  function CountPill({ count, label, tone = "neutral", className, ...rest }, ref) {
    const numeralClass =
      tone === "accent"
        ? "text-coral-text"
        : tone === "muted"
          ? "text-ink-faint"
          : "text-ink";
    const formatted = typeof count === "number" ? count.toLocaleString() : count;
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-baseline gap-0.5 font-mono tabular-nums",
          numeralClass,
          className,
        )}
        {...rest}
      >
        <span className="font-mono tabular-nums">{formatted}</span>
        {label ? (
          <span
            aria-hidden
            className="font-mono text-[0.55em] uppercase tracking-[0.04em] text-ink-faint"
          >
            {label}
          </span>
        ) : null}
      </span>
    );
  },
);

CountPill.displayName = "CountPill";