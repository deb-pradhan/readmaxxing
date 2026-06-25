import * as React from "react";
import { cn } from "../cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional accent strip at the top — 3–6px tall, full width. */
  accentStrip?: boolean;
  /** When true, card uses the inverse (dark) surface — for AI-insight sections. */
  inverse?: boolean;
  /** Padding scale. */
  padding?: "sm" | "md" | "lg" | "none";
}

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      accentStrip = false,
      inverse = false,
      padding = "md",
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-lg border",
          inverse ? "bg-inverse text-ink-inverse border-inverse" : "bg-card border-border-subtle",
          paddingClasses[padding],
          className,
        )}
        {...rest}
      >
        {accentStrip ? (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-accent"
          />
        ) : null}
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, description, action, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("mb-4 flex items-start justify-between gap-4", className)}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        {title ? (
          <h3 className="text-lg font-semibold leading-snug text-ink">
            {title}
          </h3>
        ) : null}
        {description ? (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        ) : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";