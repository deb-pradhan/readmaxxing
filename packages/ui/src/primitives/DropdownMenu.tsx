"use client";

/**
 * DropdownMenu — a keyboard-operable popover menu (UI-UX-AUDIT accessibility).
 *
 * Per audit + DESIGN-SYSTEM §11.5:
 * - Roving `tabIndex` — only the active item is `tabIndex=0`; others
 *   are `-1` so Tab leaves the menu without visiting every row.
 * - Arrow Down/Up navigate within the menu.
 * - Home/End jump to first/last.
 * - Escape closes the menu and restores focus to the trigger.
 * - Type-ahead by first letter: optional — implemented for ASCII letters
 *   with a 500ms window per char (the WAI-ARIA simple rule).
 * - Click-outside dismissal via `mousedown` listener.
 * - Items can be `disabled` or `danger` (red text on hover).
 */

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

interface TypeAheadState {
  buffer: string;
  /** Performance.now() of the last char. */
  lastAt: number;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = "start",
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLUListElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const typeAhead = React.useRef<TypeAheadState>({ buffer: "", lastAt: 0 });
  const menuId = React.useId();

  // Reset active index when the menu opens or the item list changes.
  // Also focus the active item so keyboard nav has a known starting point.
  React.useEffect(() => {
    if (open) {
      const firstEnabled = items.findIndex((it) => !it.disabled);
      setActiveIndex(firstEnabled === -1 ? 0 : firstEnabled);
    }
    return undefined;
  }, [open, items]);

  // Close on click outside / Escape. While open, capture keyboard
  // events on the menu (arrow keys, Home, End, type-ahead).
  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const focusItem = React.useCallback((idx: number) => {
    const menu = menuRef.current;
    if (!menu) return;
    const buttons = menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    const target = buttons[idx];
    if (target) target.focus();
  }, []);

  // Focus the active item once it has rendered, on open or when active changes.
  React.useEffect(() => {
    if (!open) return;
    // Defer one tick so the <ul> has rendered its <button>s.
    queueMicrotask(() => focusItem(activeIndex));
  }, [open, activeIndex, focusItem]);

  const moveActive = React.useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      let next = activeIndex;
      // Skip disabled items in either direction.
      for (let i = 0; i < items.length; i++) {
        next = (next + delta + items.length) % items.length;
        if (!items[next]?.disabled) break;
      }
      setActiveIndex(next);
      focusItem(next);
    },
    [activeIndex, items, focusItem],
  );

  const handleMenuKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setOpen(false);
          // Restore focus to the trigger.
          requestAnimationFrame(() => triggerRef.current?.focus());
          return;
        case "ArrowDown":
          event.preventDefault();
          moveActive(1);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveActive(-1);
          return;
        case "Home":
          event.preventDefault();
          {
            const first = items.findIndex((it) => !it.disabled);
            if (first !== -1) {
              setActiveIndex(first);
              focusItem(first);
            }
          }
          return;
        case "End":
          event.preventDefault();
          {
            let last = -1;
            for (let i = items.length - 1; i >= 0; i--) {
              if (!items[i]?.disabled) {
                last = i;
                break;
              }
            }
            if (last !== -1) {
              setActiveIndex(last);
              focusItem(last);
            }
          }
          return;
        default:
          // Type-ahead: a single printable character jumps to the next
          // item whose label starts with that character. 500ms buffer.
          if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
            const now = performance.now();
            const ta = typeAhead.current;
            if (now - ta.lastAt > 500) ta.buffer = "";
            ta.buffer += event.key.toLowerCase();
            ta.lastAt = now;
            const haystack = items
              .map((it) => (typeof it.label === "string" ? it.label.toLowerCase() : ""))
              .filter((_, idx) => !items[idx]?.disabled);
            const idx = haystack.findIndex((label) => label.startsWith(ta.buffer));
            if (idx !== -1) {
              setActiveIndex(idx);
              focusItem(idx);
            }
          }
          return;
      }
    },
    [items, moveActive, focusItem],
  );

  const triggerEl = React.cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const original = (trigger as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof original === "function") original(node);
      else if (original && typeof original === "object") {
        (original as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onClick: (event: React.MouseEvent) => {
      setOpen((o) => !o);
      const existing = (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick;
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
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-elevated p-1 shadow-md",
            align === "start" ? "left-0" : "right-0",
            className,
          )}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={idx === activeIndex ? 0 : -1}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect?.();
                    setOpen(false);
                    requestAnimationFrame(() => triggerRef.current?.focus());
                  }}
                  onFocus={() => setActiveIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-sm h-10 px-3 text-left text-sm",
                    "transition-colors duration-fast",
                    item.disabled
                      ? "cursor-not-allowed text-ink-faint"
                      : item.danger
                        ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10"
                        : "text-ink hover:bg-[var(--hover-tint)] focus-visible:bg-[var(--hover-tint)]",
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
                <li role="separator" aria-hidden className="my-1 h-px bg-border-subtle" />
              ) : null}
            </React.Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

DropdownMenu.displayName = "DropdownMenu";