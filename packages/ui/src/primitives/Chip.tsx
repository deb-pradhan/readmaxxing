import * as React from "react";
import { cn } from "../cn";

export type ChipVariant =
  | "neutral"
  | "accent"
  | "coral"
  | "butter"
  | "lavender"
  | "mint"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  /** Optional leading icon. */
  icon?: React.ReactNode;
}

/**
 * Chip / Tag — DESIGN-SYSTEM §11.1 (Tag/Chip pill):
 * - Height 28px, full radius.
 * - Padding 0 12px, 12–13px medium.
 * - Variants map onto the brand + semantic scales.
 */
const variantClasses: Record<ChipVariant, string> = {
  neutral: "bg-card-muted text-ink-muted",
  accent: "bg-coral-soft text-coral-text",
  coral: "bg-coral-bg text-white",
  butter: "bg-butter-bg text-butter-text",
  lavender: "bg-lavender-bg text-lavender-text",
  mint: "bg-mint-bg text-mint-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ variant = "neutral", icon, className, children, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
          variantClasses[variant],
          className,
        )}
        {...rest}
      >
        {icon ? (
          <span aria-hidden className="inline-flex shrink-0">
            {icon}
          </span>
        ) : null}
        <span className="leading-none">{children}</span>
      </span>
    );
  },
);

Chip.displayName = "Chip";