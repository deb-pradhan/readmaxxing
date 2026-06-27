"use client";

import * as React from "react";
import { cn } from "../cn";

export interface TooltipProps {
  /** The trigger element. The tooltip is anchored to its bounding rect. */
  children: React.ReactElement;
  /** Tooltip content. */
  content: React.ReactNode;
  /** Placement relative to the trigger. */
  side?: "top" | "bottom" | "left" | "right";
  /** Delay in ms before showing. */
  delay?: number;
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Lightweight tooltip (DESIGN-SYSTEM §11.5 — popover/dropdown menu
 * style). Pure CSS hover/focus reveal — no portal, no floating-ui
 * dependency. Adds a labeled description to the trigger via
 * `aria-describedby` so screen readers announce the tooltip text.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  side = "top",
  delay = 250,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = React.useId();

  const show = React.useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = React.useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(children, {
        "aria-describedby": tooltipId,
      } as Record<string, unknown>)}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-inverse px-2.5 py-1.5 text-xs font-medium text-ink-inverse",
          "transition-opacity duration-fast ease-out",
          open ? "opacity-100" : "opacity-0",
          sideClasses[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
};

Tooltip.displayName = "Tooltip";