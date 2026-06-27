"use client";

/**
 * KeyboardShortcuts — `?` modal listing the keyboard shortcuts.
 */

import * as React from "react";
import { Button, cn } from "@readmaxxing/ui";

export interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
  className?: string;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["Space"], description: "Play / pause" },
  { keys: ["←", "→"], description: "Seek ±15 seconds" },
  { keys: ["Shift", "← / →"], description: "Seek ±30 seconds" },
  { keys: ["↑", "↓"], description: "Speed ±0.25×" },
  { keys: ["J"], description: "Previous sentence" },
  { keys: ["K"], description: "Next sentence" },
  { keys: ["R"], description: "Repeat sentence" },
  { keys: ["F"], description: "Toggle focus mode" },
  { keys: ["B"], description: "Toggle bionic reading" },
  { keys: ["T"], description: "Cycle theme" },
  { keys: ["/"], description: "Search (Cmd/Ctrl+K)" },
  { keys: ["Cmd / Ctrl", "K"], description: "Open command palette" },
  { keys: ["?"], description: "This help" },
  { keys: ["Esc"], description: "Close any open sheet" },
];

export function KeyboardShortcuts({
  open,
  onClose,
  className,
}: KeyboardShortcutsProps): React.JSX.Element | null {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className={cn(
        "fixed inset-0 z-modal flex items-center justify-center bg-overlay p-4",
        className,
      )}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-subtle bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Keyboard shortcuts</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            // Phase D P1 (D.11): ≥44px touch target. Close button was 36×36.
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
          >
            ✕
          </button>
        </header>
        <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-3 text-sm">
          {SHORTCUTS.map((s, idx) => (
            <React.Fragment key={`${s.description}-${idx}`}>
              <dt className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${k}-${i}`}
                    className="tabular inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border bg-card-muted px-1.5 py-0.5 font-mono text-xs text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-ink">{s.description}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="primary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Tip: shortcuts work anywhere on the reader page except inside text
          inputs.
        </p>
      </div>
    </div>
  );
}