"use client";

import * as React from "react";
import { cn } from "../cn";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible title — required for a11y. */
  title: React.ReactNode;
  /** Optional longer description for screen readers. */
  description?: React.ReactNode;
  /** Centered modal (default) vs bottom-sheet (mobile). */
  variant?: "modal" | "sheet";
  children: React.ReactNode;
  /** Footer (typically action buttons). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Accessible modal dialog built on the native `<dialog>` element.
 * - Closes on Escape, on scrim click, and on `onOpenChange(false)`.
 * - Traps focus while open via `showModal()`.
 * - Respects `prefers-reduced-motion` (no transforms; opacity-only).
 *
 * Note: uses native `<dialog>` so we don't need a radix dependency in Phase 1.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  variant = "modal",
  children,
  footer,
  className,
}) => {
  const ref = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleScrimClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={handleClose}
      onClick={handleScrimClick}
      className={cn(
        "p-0 backdrop:bg-overlay",
        variant === "modal"
          ? "max-w-[480px] rounded-xl"
          : "max-sm:max-w-full sm:max-w-[480px] rounded-t-xl sm:rounded-xl fixed bottom-0 inset-x-0 sm:inset-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-8">
        <h2 id={titleId} className="text-xl font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
        <div className="text-sm text-ink">{children}</div>
        {footer ? (
          <div className="mt-2 flex items-center justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
};

Dialog.displayName = "Dialog";