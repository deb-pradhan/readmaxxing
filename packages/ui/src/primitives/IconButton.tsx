"use client";

/**
 * IconButton — circular icon-only button (DESIGN-SYSTEM §25.5).
 *
 * Replaces the legacy `rounded-md bg-card` square chrome. Three intents
 * (primary, secondary, ghost) + three heights (36/44/52). Always ≥44px
 * for touch unless size="sm" (36) is explicitly opted-in.
 *
 * Accessibility: a real `<button>` element, focusable via Tab, with a
 * required `aria-label` (the icon is decorative). Use `Icon` for the
 * glyph via `icon={IconName}` or pass any node via `iconNode`.
 */

import * as React from "react";
import { cn } from "../cn";
import { Icon, type IconName } from "./Icon";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonIntent = "primary" | "secondary" | "ghost";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Lucide icon name. */
  icon?: IconName;
  /** Pre-rendered icon node (alternative to `icon`). */
  iconNode?: React.ReactNode;
  /** Required — the icon is decorative, the button needs a label. */
  "aria-label": string;
  /** Visual size. Defaults to `md` (44px — meets the 44px touch target). */
  size?: IconButtonSize;
  /** Visual intent. */
  intent?: IconButtonIntent;
  /** Match the stroke width used in `Icon`. */
  strokeWidth?: number;
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-9 w-9", // 36 — explicit opt-out from 44px touch target
  md: "h-11 w-11", // 44 — default, ≥44px
  lg: "h-[3.25rem] w-[3.25rem]", // 52
};

const iconSizeClasses: Record<IconButtonSize, 16 | 20 | 24> = {
  sm: 20,
  md: 20,
  lg: 24,
};

const intentClasses: Record<IconButtonIntent, string> = {
  // Primary: coral CTA — for the one featured icon action per screen.
  primary:
    "bg-coral-bg text-white hover:bg-coral-600 active:scale-[0.95]",
  // Secondary: soft fill — the reference's gray filter button.
  secondary:
    "bg-card-muted text-ink hover:bg-ink/10 active:scale-[0.95]",
  // Ghost: transparent until hover — quiet tools.
  ghost:
    "bg-transparent text-ink-muted hover:bg-card-muted hover:text-ink active:scale-[0.95]",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      iconNode,
      "aria-label": ariaLabel,
      size = "md",
      intent = "secondary",
      strokeWidth,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const glyph = iconNode ?? (icon ? (
      <Icon name={icon} size={iconSizeClasses[size]} strokeWidth={strokeWidth} />
    ) : null);
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all duration-fast ease-out",
          "focus-visible:outline-none focus-visible:shadow-focus",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          sizeClasses[size],
          intentClasses[intent],
          className,
        )}
        {...rest}
      >
        {glyph}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";