import * as React from "react";
import { cn } from "../cn";

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** Render as a different element when the eyebrow is a heading or block label. */
  as?: "span" | "div" | "p";
}

/**
 * Eyebrow — UPPERCASE micro-label above a section title.
 *
 * Per DESIGN-SYSTEM §25.2: 11–12px, weight 600, +0.08em tracking.
 * Used at the top of every page header (e.g. "PLACE", "NOW PLAYING",
 * "CONTINUE") and on every bento section. Sits above a Display-1/2
 * title — never alone.
 */
function EyebrowImpl(
  { as = "span", className, children, ...rest }: EyebrowProps,
  ref: React.Ref<HTMLElement>,
): React.JSX.Element {
  const baseClass = cn(
    "block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted",
    className,
  );
  if (as === "div") {
    return <div ref={ref as React.Ref<HTMLDivElement>} className={baseClass} {...rest}>{children}</div>;
  }
  if (as === "p") {
    return <p ref={ref as React.Ref<HTMLParagraphElement>} className={baseClass} {...rest}>{children}</p>;
  }
  return <span ref={ref as React.Ref<HTMLSpanElement>} className={baseClass} {...rest}>{children}</span>;
}

export const Eyebrow = React.forwardRef<HTMLElement, EyebrowProps>(EyebrowImpl);

Eyebrow.displayName = "Eyebrow";