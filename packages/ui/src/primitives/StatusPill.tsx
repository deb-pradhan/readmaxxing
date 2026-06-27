import * as React from "react";
import { cn } from "../cn";

export type StatusPillStatus = "ready" | "queued" | "rendering" | "error" | "complete";
export type StatusPillTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Internal state. The pill maps it to a copy-stable label. */
  status: StatusPillStatus;
  /** Override the default copy. */
  label?: string;
  /** Visual tone (defaults to a status-appropriate mapping). */
  tone?: StatusPillTone;
}

/**
 * StatusPill — mono, deterministic, never lies (DESIGN-SYSTEM §25.8 + D15).
 *
 * Maps an internal status to a copy-stable label. Labels are honest:
 *   - `queued`     → "Queued"
 *   - `rendering`  → "Rendering"
 *   - `ready`      → "Ready"
 *   - `complete`   → "Complete"
 *   - `error`      → "Failed" (never "come back later")
 *
 * Tones are bound to the status by default; the `tone` prop is an
 * explicit override for narrow cases (e.g. a `rendering` widget you
 * want to render as `warning`).
 */

const DEFAULT_LABEL: Record<StatusPillStatus, string> = {
  ready: "Ready",
  queued: "Queued",
  rendering: "Rendering",
  error: "Failed",
  complete: "Complete",
};

const DEFAULT_TONE: Record<StatusPillStatus, StatusPillTone> = {
  ready: "info",
  queued: "neutral",
  rendering: "info",
  error: "danger",
  complete: "success",
};

const toneClasses: Record<StatusPillTone, string> = {
  neutral: "bg-card-muted text-ink-muted",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  function StatusPill({ status, label, tone, className, ...rest }, ref) {
    const resolvedTone = tone ?? DEFAULT_TONE[status];
    const resolvedLabel = label ?? DEFAULT_LABEL[status];
    return (
      <span
        ref={ref}
        data-status={status}
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-mono text-xs font-medium uppercase tracking-[0.04em]",
          toneClasses[resolvedTone],
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
            status === "rendering" && "animate-pulse",
          )}
        />
        <span className="leading-none">{resolvedLabel}</span>
      </span>
    );
  },
);

StatusPill.displayName = "StatusPill";