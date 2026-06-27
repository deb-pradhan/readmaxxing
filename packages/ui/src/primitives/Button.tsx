"use client";

/**
 * Button — the pill button system (DESIGN-SYSTEM §25.5).
 *
 * One shape (`rounded-full`), three heights (36/44/52), four variants.
 * White-on-`coral-600` is 4.62:1 — AA-safe for body-size labels.
 * Hover is derived from the token via CSS (color-mix in globals.css) —
 * **no hex literal** lives in this file (audit B finding).
 *
 * API is stable: existing call sites using `<Button variant="primary" size="md" />`
 * keep compiling. Variants are aliased so old call sites (`"icon"`, `"danger"`)
 * still resolve.
 */

import * as React from "react";
import { cn } from "../cn";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant =
  /** Coral-600 fill (AA-safe). The one hero CTA per screen. */
  | "primary"
  /** Ink fill — for CTAs on coral / busy / photo surfaces ("Pause", "Menu"). */
  | "inverse"
  /** White card + hairline border — secondary actions ("Log out", "Scan an image"). */
  | "secondary"
  /** Transparent — ghost / inline; hover tints to coral-050. */
  | "ghost"
  /** Legacy aliases — kept for one release to avoid breaking existing call sites. */
  | "danger"
  | "icon";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render an icon-only square (legacy). Prefer `IconButton` for new code. */
  iconOnly?: boolean;
  loading?: boolean;
  /** Optional leading icon (Lucide name). Renders via `<Icon>`. */
  icon?: IconName;
  /** Trailing icon (Lucide name). */
  iconTrailing?: IconName;
  /** Override the leading icon node (advanced — when you need a non-Lucide glyph). */
  iconLeading?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-coral-600 text-white hover:bg-coral-700 focus-visible:shadow-focus",
  inverse:
    "bg-ink text-ink-inverse hover:bg-ink/90 focus-visible:shadow-focus",
  secondary:
    "bg-card text-ink border border-border hover:bg-card-muted focus-visible:shadow-focus",
  ghost:
    "bg-transparent text-ink hover:bg-coral-soft hover:text-coral-text focus-visible:shadow-focus",
  // Legacy aliases (mapped to v2 equivalents).
  danger:
    "bg-danger text-white hover:bg-danger/90 focus-visible:shadow-focus",
  icon:
    "bg-transparent text-ink hover:bg-card-muted focus-visible:shadow-focus",
};

// Heights per DESIGN-SYSTEM §25.5: 36 / 44 / 52. Pill shape (`rounded-full`).
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-2",
  md: "h-11 px-5 text-base gap-2",
  lg: "h-[3.25rem] px-6 text-md gap-2.5",
};

const iconOnlyClasses: Record<ButtonSize, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-[3.25rem] w-[3.25rem]",
};

const labelSize: Record<ButtonSize, "text-sm" | "text-base" | "text-md"> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-md",
};

/**
 * <Button.Icon> — a slot for a leading icon when you need a non-Lucide
 * custom node. Forward-ref'd so it composes with `Tooltip` and other
 * wrappers that need a ref to the underlying span.
 */
export const ButtonIcon = React.forwardRef<
  HTMLSpanElement,
  { children: React.ReactNode; className?: string }
>(function ButtonIcon({ children, className }, ref) {
  return (
    <span ref={ref} aria-hidden className={cn("inline-flex shrink-0", className)}>
      {children}
    </span>
  );
});
ButtonIcon.displayName = "Button.Icon";

const ButtonImpl = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    iconOnly = false,
    loading = false,
    icon,
    iconTrailing,
    iconLeading,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap",
        "transition-all duration-fast ease-out active:scale-[0.97]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none",
        labelSize[size],
        variantClasses[variant],
        iconOnly ? iconOnlyClasses[size] : sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {iconLeading ? (
        <span aria-hidden className="inline-flex shrink-0">
          {iconLeading}
        </span>
      ) : icon ? (
        <Icon
          name={icon}
          size={size === "lg" ? 20 : 16}
          strokeWidth={1.75}
          aria-hidden
        />
      ) : null}
      {children ? <span className="leading-none">{children}</span> : null}
      {iconTrailing ? (
        <Icon
          name={iconTrailing}
          size={size === "lg" ? 20 : 16}
          strokeWidth={1.75}
          aria-hidden
        />
      ) : null}
    </button>
  );
});
ButtonImpl.displayName = "Button";

/**
 * The exported `Button` is the forwardRef component augmented with the
 * `.Icon` static subcomponent. Consumers can write `<Button>` and
 * `<Button.Icon>` interchangeably.
 */
export interface ButtonComponent {
  (props: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }): React.JSX.Element;
  displayName?: string;
  Icon: typeof ButtonIcon;
}

export const Button = ButtonImpl as unknown as ButtonComponent;
Button.displayName = "Button";
Button.Icon = ButtonIcon;