"use client";

import * as React from "react";
import { cn } from "../cn";

export type ToastVariant = "success" | "warning" | "danger" | "info";

export interface ToastProps {
  /** Visible message. */
  message: React.ReactNode;
  variant?: ToastVariant;
  /** Optional title shown above the message. */
  title?: React.ReactNode;
  /** Optional action button. */
  action?: { label: React.ReactNode; onClick: () => void };
  /** Optional close handler. */
  onDismiss?: () => void;
  className?: string;
}

const variantClasses: Record<ToastVariant, string> = {
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

const variantIcon: Record<ToastVariant, string> = {
  success: "✓",
  warning: "!",
  danger: "✕",
  info: "i",
};

/**
 * Toast — DESIGN-SYSTEM §11.6:
 * - 16px radius, shadow-md.
 * - Position: top-center desktop, top of screen on mobile (below
 *   status bar) — handled by the consumer's wrapping container.
 * - Variants: success / warning / danger / info with leading icon.
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  variant = "info",
  title,
  action,
  onDismiss,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-md border bg-card p-4 shadow-md",
        variantClasses[variant],
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current text-xs font-bold text-card"
      >
        {variantIcon[variant]}
      </span>
      <div className="flex-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        <p className="text-sm">{message}</p>
        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss?.();
            }}
            className="mt-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          // Phase D P1 (D.11): ≥44px touch target. We use the negative
          // margin trick so the visible footprint stays tight while the
          // hit area meets WCAG / Apple HIG minimums.
          className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-current/10 focus-visible:outline-none focus-visible:shadow-focus"
        >
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
};

Toast.displayName = "Toast";

export interface ToastRegionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ToastRegion — fixed top-center positioning wrapper. Desktop shows
 * toasts below the top of the screen; mobile drops just below the
 * status bar via the safe-area inset on `top`.
 */
export const ToastRegion: React.FC<ToastRegionProps> = ({ children, className }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-4 z-toast flex flex-col items-center gap-2 px-4 sm:top-6",
        className,
      )}
    >
      {children}
    </div>
  );
};

ToastRegion.displayName = "ToastRegion";