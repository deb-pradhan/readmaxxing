"use client";

import * as React from "react";
import { cn } from "../cn";

export interface DropdownMenuItem {
  /** Visible label. */
  label: React.ReactNode;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Click handler. */
  onSelect?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Destructive / danger styling. */
  danger?: boolean;
  /** Optional separator rendered after this item. */
  separator?: boolean;
}

export interface DropdownMenuProps {
  /** The trigger element (typically a Button). */
  trigger: React.ReactElement;
  items: DropdownMenuItem[];
  /** Side relative to the trigger. */
  align?: "start" | "end";
  className?: string;
}

/**
 * Minimal DropdownMenu. Implemented as a positioned menu with click-outside
 * dismissal and Escape handling. No portal in Phase 1 — the trigger's parent
 * must allow `position: relative`.
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = "start",
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerEl = React.cloneElement(trigger, {
    onClick: (event: React.MouseEvent) => {
      setOpen((o) => !o);
      const existing = (trigger.props as { onClick?: (e: React.MouseEvent) => void })
        .onClick;
      existing?.(event);
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": menuId,
  } as Record<string, unknown>);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {triggerEl}
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-elevated p-1 shadow-md",
            align === "start" ? "left-0" : "right-0",
            className,
          )}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect?.();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm",
                    "transition-colors duration-fast",
                    item.disabled
                      ? "cursor-not-allowed text-ink-faint"
                      : item.danger
                        ? "text-danger hover:bg-danger/10"
                        : "text-ink hover:bg-[var(--hover-tint)]",
                  )}
                >
                  {item.icon ? (
                    <span aria-hidden className="text-ink-muted">
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="flex-1">{item.label}</span>
                </button>
              </li>
              {item.separator ? (
                <li aria-hidden className="my-1 h-px bg-border-subtle" />
              ) : null}
            </React.Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

DropdownMenu.displayName = "DropdownMenu";