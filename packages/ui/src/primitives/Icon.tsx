"use client";

/**
 * Icon — Lucide wrapper (DESIGN-SYSTEM §25.4).
 *
 * One stroke (1.75), two sizes (20 inline / 24 chrome), `currentColor`.
 * Renders a Lucide icon by name. Tree-shakeable: only icons imported by
 * name ever ship. Every consumer goes through this wrapper so size,
 * stroke, and `aria-hidden` stay consistent.
 *
 * Accessibility: decorative by default (`aria-hidden="true"`). Pass
 * `aria-label` (or `aria-labelledby`) plus a non-decorative title via
 * `accessibilityLabel` to expose the glyph as a meaningful icon.
 */

import * as React from "react";
import { cn } from "../cn";
import * as Lucide from "lucide-react";

/**
 * Lucide names are PascalCase (`ArrowUpRight`) but the design-system
 * canonical spellings are kebab-case (`arrow-up-right`). We accept
 * either form and resolve via a one-time lookup table.
 */
function resolveIconName(name: string): keyof typeof Lucide | null {
  if (name in Lucide) return name as keyof typeof Lucide;
  // kebab-case → PascalCase: "arrow-up-right" → "ArrowUpRight".
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  if (pascal in Lucide) return pascal as keyof typeof Lucide;
  return null;
}

export type IconName = keyof typeof Lucide | string;

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, "name"> {
  /** Lucide icon name, e.g. `"play"` (PascalCase) or `"arrow-up-right"` (kebab-case). */
  name: IconName;
  /** Pixel size for width + height. */
  size?: 16 | 20 | 24;
  /** Stroke width passed through to Lucide. */
  strokeWidth?: number;
  /** Forwarded; setting this exposes the icon as a meaningful image. */
  "aria-label"?: string;
  className?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 20, strokeWidth = 1.75, className, "aria-label": ariaLabel, ...rest },
  ref,
) {
  const resolved = resolveIconName(String(name));
  if (!resolved) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] Unknown Lucide icon: ${String(name)}`);
    }
    return null;
  }
  const Component = Lucide[resolved] as React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    "aria-hidden"?: boolean | "true" | "false";
    "aria-label"?: string;
    role?: string;
    className?: string;
    ref?: React.Ref<SVGSVGElement>;
  }>;
  const isDecorative = !ariaLabel;
  return (
    <Component
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      aria-hidden={isDecorative ? "true" : undefined}
      aria-label={ariaLabel}
      role={isDecorative ? undefined : "img"}
      {...rest}
    />
  );
});