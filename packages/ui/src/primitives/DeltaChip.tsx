import * as React from "react";
import { cn } from "../cn";

export type DeltaDirection = "up" | "down" | "flat";

export interface DeltaChipProps {
  /** Percentage or relative change to display. */
  value: string | number;
  direction?: DeltaDirection;
  /** Invert colors for cases where "down is good" (e.g. time spent). */
  invert?: boolean;
  /** Optional aria-label override. */
  ariaLabel?: string;
  className?: string;
}

/**
 * DeltaChip — DESIGN-SYSTEM §14.4:
 * - Pill shape, 22px height, full radius.
 * - Arrow + percentage: ↑ 7.5% (mint for positive) or ↓ 2.4% (danger
 *   for negative).
 * - When `invert` is true, "down is good" so directions flip.
 */
const ARROW: Record<DeltaDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

export const DeltaChip: React.FC<DeltaChipProps> = ({
  value,
  direction,
  invert = false,
  ariaLabel,
  className,
}) => {
  // Derive direction from sign when not provided.
  const inferred: DeltaDirection =
    direction ??
    (typeof value === "number"
      ? value > 0
        ? "up"
        : value < 0
          ? "down"
          : "flat"
      : "flat");
  const isUp = inferred === "up";
  const isDown = inferred === "down";
  // When inverted (down-is-good), up is bad and down is good.
  const positive = invert ? isDown : isUp;
  const colorClass = !isUp && !isDown
    ? "bg-card-muted text-ink-muted"
    : positive
      ? "bg-mint-bg text-mint-text"
      : "bg-danger-soft text-danger";
  const label =
    typeof value === "number"
      ? `${Math.abs(value).toFixed(1)}%`
      : value;
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? `${ARROW[inferred]} ${label}`}
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-xs font-semibold leading-none tabular",
        colorClass,
        className,
      )}
    >
      <span aria-hidden>{ARROW[inferred]}</span>
      <span>{label}</span>
    </span>
  );
};

DeltaChip.displayName = "DeltaChip";