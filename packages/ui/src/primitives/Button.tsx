"use client";

import * as React from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render an icon-only square button. Always 44×44+ for Fitts's Law. */
  iconOnly?: boolean;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent/90 active:scale-[0.97] focus-visible:shadow-focus",
  secondary:
    "bg-card text-ink border border-border hover:bg-card-muted active:scale-[0.97] focus-visible:shadow-focus",
  ghost:
    "bg-transparent text-ink hover:bg-[var(--hover-tint)] active:scale-[0.97] focus-visible:shadow-focus",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:scale-[0.97] focus-visible:shadow-focus",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-md gap-2",
  md: "h-11 px-5 text-base rounded-md gap-2",
  lg: "h-14 px-6 text-md rounded-lg gap-3",
};

const iconOnlyClasses: Record<ButtonSize, string> = {
  sm: "h-10 w-10 rounded-md",
  md: "h-11 w-11 rounded-md",
  lg: "h-14 w-14 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      iconOnly = false,
      loading = false,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-fast ease-out",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:shadow-focus",
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
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";