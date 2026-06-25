import * as React from "react";
import { cn } from "../cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible label rendered above the input. */
  label?: React.ReactNode;
  /** Helper / error text rendered below. */
  helper?: React.ReactNode;
  /** Leading icon or adornment. */
  leading?: React.ReactNode;
  /** Trailing icon or adornment. */
  trailing?: React.ReactNode;
  /** When true, helper text is rendered in the danger color. */
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, helper, leading, trailing, error, className, id, ...rest },
    ref,
  ) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const helperId = helper ? `${inputId}-helper` : undefined;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "flex h-12 items-center gap-2 rounded-md border bg-card-muted px-4",
            "transition-shadow duration-fast",
            "focus-within:border-accent focus-within:shadow-focus",
            error
              ? "border-danger focus-within:border-danger focus-within:shadow-[0_0_0_3px_rgba(210,56,56,0.35)]"
              : "border-border",
          )}
        >
          {leading ? (
            <span aria-hidden className="text-ink-muted">
              {leading}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={helperId}
            aria-invalid={error || undefined}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint outline-none",
              className,
            )}
            {...rest}
          />
          {trailing ? (
            <span aria-hidden className="text-ink-muted">
              {trailing}
            </span>
          ) : null}
        </div>
        {helper ? (
          <p
            id={helperId}
            className={cn(
              "text-xs",
              error ? "text-danger" : "text-ink-muted",
            )}
          >
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  helper?: React.ReactNode;
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helper, error, className, id, ...rest }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-[96px] w-full resize-y rounded-md border bg-card-muted px-4 py-3 text-base text-ink placeholder:text-ink-faint outline-none transition-shadow duration-fast focus:border-accent focus:shadow-focus",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...rest}
        />
        {helper ? (
          <p className={cn("text-xs", error ? "text-danger" : "text-ink-muted")}>
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";