"use client";

/**
 * ReadingRuler — horizontal line guide that follows mouse/touch Y.
 */

import * as React from "react";
import { cn } from "@readmaxxing/ui";

export interface ReadingRulerProps {
  /** When true, render the ruler + listen for pointer events. */
  active: boolean;
  className?: string;
}

export function ReadingRuler({
  active,
  className,
}: ReadingRulerProps): React.JSX.Element | null {
  const [y, setY] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!active) {
      setY(null);
      return;
    }
    const onMove = (e: PointerEvent) => setY(e.clientY);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active]);

  if (!active || y === null) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 z-overlay h-px bg-coral-bg/70",
        className,
      )}
      style={{ top: y }}
    />
  );
}