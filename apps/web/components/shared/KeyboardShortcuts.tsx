"use client";

/**
 * KeyboardShortcuts — `?` modal listing the keyboard shortcuts.
 *
 * Phase D P1 (D.5a): refactored to render inside the shared `Dialog`
 * primitive. Escape closes (Dialog handles it), scrim-click closes,
 * focus is trapped. We drop the manual Escape handler and the manual
 * scrim overlay.
 */

import * as React from "react";
import { Button, Dialog, cn } from "@readmaxxing/ui";

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
}: KeyboardShortcutsProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Keyboard shortcuts"
      className={cn("max-w-md", className)}
    >
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
    </Dialog>
  );
}