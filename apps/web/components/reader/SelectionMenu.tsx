"use client";

/**
 * SelectionMenu — selection actions on reader text.
 *
 * Per DESIGN-SYSTEM §5: when the user selects text, offer "Listen
 * from here", "Summarize this", "Ask about this", "Copy". Positioned
 * at the selection's bounding rect via Radix Popover.
 */

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@readmaxxing/ui";

export interface SelectionMenuProps {
  /** Optional rect returned by Selection.getRangeAt(0).getBoundingClientRect(). */
  rect: DOMRect | null;
  /** Fire when the popover should dismiss (e.g. user clicks elsewhere). */
  onDismiss: () => void;
  onListenFromHere?: () => void;
  onSummarize?: () => void;
  onAsk?: () => void;
  onCopy?: () => void;
  className?: string;
}

const ACTIONS: Array<{
  key: string;
  label: string;
  getHandler: (
    p: Pick<SelectionMenuProps, "onListenFromHere" | "onSummarize" | "onAsk" | "onCopy">,
  ) => (() => void) | undefined;
}> = [
  { key: "listen", label: "Listen from here", getHandler: (p) => p.onListenFromHere },
  { key: "summarize", label: "Summarize this", getHandler: (p) => p.onSummarize },
  { key: "ask", label: "Ask about this", getHandler: (p) => p.onAsk },
  { key: "copy", label: "Copy", getHandler: (p) => p.onCopy },
];

export function SelectionMenu({
  rect,
  onDismiss,
  onListenFromHere,
  onSummarize,
  onAsk,
  onCopy,
  className,
}: SelectionMenuProps): React.JSX.Element | null {
  if (!rect) return null;

  const anchorStyle: React.CSSProperties = {
    position: "fixed",
    left: rect.left + rect.width / 2,
    top: rect.top - 8,
    width: 1,
    height: 1,
    pointerEvents: "none",
  };

  return (
    <Popover.Root open={!!rect} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <Popover.Anchor style={anchorStyle} />
      <Popover.Portal>
        <Popover.Content
          align="center"
          side="top"
          sideOffset={8}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "z-modal rounded-md border border-border-subtle bg-elevated p-1 shadow-md",
            "min-w-[180px] animate-fadeIn",
            className,
          )}
        >
          {ACTIONS.map((action) => {
            const handler = action.getHandler({
              onListenFromHere,
              onSummarize,
              onAsk,
              onCopy,
            });
            return (
              <button
                key={action.key}
                type="button"
                disabled={!handler}
                onClick={() => {
                  handler?.();
                  onDismiss();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm h-10 px-3 text-left text-sm",
                  "transition-colors duration-fast ease-out",
                  handler
                    ? "text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
                    : "cursor-not-allowed text-ink-faint",
                )}
              >
                {action.label}
              </button>
            );
          })}
          <Popover.Arrow className="fill-elevated" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}