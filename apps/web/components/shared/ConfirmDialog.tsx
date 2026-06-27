"use client";

/**
 * ConfirmDialog — in-page confirmation for destructive actions.
 *
 * Phase E (E.4) replaces every `alert()` call in settings with this
 * dialog. Built on the existing `Dialog` primitive (native
 * `<dialog>.showModal()`), so focus trapping, focus restore, scrim
 * click, and Escape-to-close come for free.
 *
 * Rules:
 *  - Default focus lands on **Cancel** (safer default — destructive
 *    confirm never wins the focus race).
 *  - For destructive actions (`intent="destructive"`), the Confirm
 *    button uses the **secondary** variant, not coral. D31 bans red
 *    in the habit layer, and a coral "Delete" reads as triumphant;
 *    a quiet pill + explicit copy keeps the action honest.
 *  - Copy is sentence-case, ends with `.`, no implied user fault
 *    (DESIGN-SYSTEM §17.3).
 */

import * as React from "react";
import { Button, Dialog } from "@readmaxxing/ui";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short, sentence-case heading. */
  title: string;
  /** 1–2 sentence explanation of what will happen. */
  description: string;
  /** Label for the confirm button (e.g. "Clear cache"). */
  confirmLabel: string;
  /** Label for the cancel button (default: "Cancel"). */
  cancelLabel?: string;
  /**
   * Intent drives Confirm-button styling.
   *  - `default` → primary coral (for non-destructive confirmations)
   *  - `destructive` → secondary, neutral (for delete / clear / logout)
   */
  intent?: "default" | "destructive";
  /**
   * Optional async handler. While it runs, the Confirm button shows
   * its loading spinner and is disabled.
   */
  onConfirm?: () => void | Promise<void>;
  /**
   * Inline content — useful for "type the word to confirm" patterns
   * in future phases. Defaults to nothing.
   */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  intent = "default",
  onConfirm,
  children,
}: ConfirmDialogProps): React.JSX.Element {
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const [busy, setBusy] = React.useState(false);

  // When the dialog opens, move focus to Cancel — the safer default
  // for destructive actions. We focus synchronously after the next
  // paint tick; in jsdom (tests) we focus on the immediate effect so
  // the test sees the focused element without RAF plumbing.
  React.useEffect(() => {
    if (!open) return;
    const node = cancelRef.current;
    if (!node) return;
    node.focus();
  }, [open]);

  const handleConfirm = React.useCallback(async (): Promise<void> => {
    if (!onConfirm) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={intent === "destructive" ? "secondary" : "primary"}
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

ConfirmDialog.displayName = "ConfirmDialog";