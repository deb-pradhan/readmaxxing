"use client";

/**
 * CommandPalette — Cmd/Ctrl+K palette. Wraps the `cmdk` library.
 *
 * Phase D P1 (D.5a): refactored to render inside the shared `Dialog`
 * primitive (native `<dialog>` element). That gives us Escape-to-close,
 * scrim-click-to-close, and the browser's built-in focus trap — all the
 * things the prior manual `<div role="dialog">` was missing.
 */

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog, cn } from "@readmaxxing/ui";

export interface CommandPaletteAction {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  perform: () => void;
}

export interface CommandPaletteProps {
  /** Static list — the consumer fetches docs + wires navigation actions. */
  actions: CommandPaletteAction[];
  /** Controlled open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function CommandPalette({
  actions,
  open,
  onOpenChange,
  className,
}: CommandPaletteProps): React.JSX.Element {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      className={cn("max-w-xl !p-2", className)}
    >
      <Command label="Command palette" className="w-full">
        <Command.Input
          ref={inputRef}
          placeholder="Search documents or type a command…"
          className="w-full rounded-md bg-card-muted px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <Command.List className="mt-2 max-h-[60vh] overflow-y-auto">
          <Command.Empty className="px-4 py-3 text-sm text-ink-muted">
            No matches. Try a different search.
          </Command.Empty>
          <Command.Group
            heading="Library"
            className="px-1 py-1 text-xs uppercase tracking-widest text-ink-muted"
          >
            {actions.map((action) => (
              <Command.Item
                key={action.id}
                value={action.label}
                onSelect={() => {
                  action.perform();
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-sm h-10 px-3 text-sm text-ink aria-selected:bg-coral-soft aria-selected:text-coral-text"
              >
                <span>{action.label}</span>
                {action.hint ? (
                  <span className="tabular text-xs text-ink-faint">{action.hint}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Separator className="my-1 h-px bg-border-subtle" />
          <Command.Group
            heading="Quick actions"
            className="px-1 py-1 text-xs uppercase tracking-widest text-ink-muted"
          >
            <Command.Item
              value="Open library"
              onSelect={() => {
                router.push("/library");
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between rounded-sm h-10 px-3 text-sm text-ink aria-selected:bg-coral-soft aria-selected:text-coral-text"
            >
              Open library
            </Command.Item>
            <Command.Item
              value="Show shortcuts"
              onSelect={() => {
                window.dispatchEvent(new CustomEvent("rmx:show-shortcuts"));
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between rounded-sm h-10 px-3 text-sm text-ink aria-selected:bg-coral-soft aria-selected:text-coral-text"
            >
              Show keyboard shortcuts
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </Dialog>
  );
}