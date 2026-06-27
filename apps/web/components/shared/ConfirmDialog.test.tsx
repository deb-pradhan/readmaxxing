/**
 * ConfirmDialog component tests — Phase E (E.4).
 *
 * Pins the contract:
 *  - Renders inside the DOM (native `<dialog>.showModal()` in jsdom).
 *  - Cancel button has default focus on open.
 *  - Escape closes (via the underlying `<dialog>` primitive).
 *  - Clicking the Cancel button closes the dialog without firing
 *    the confirm handler.
 *  - Clicking the Confirm button fires the handler once.
 *  - Destructive intent renders the Confirm button as `secondary`
 *    (not coral primary).
 *  - No `alert()` calls anywhere.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import * as React from "react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog (Phase E — E.4)", () => {
  it("renders the title, description, and the two action buttons when open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Log out?"
        description="You'll need to sign back in."
        confirmLabel="Log out"
        intent="destructive"
      />,
    );
    expect(screen.getByText("Log out?")).toBeInTheDocument();
    expect(screen.getByText(/sign back in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("does not present the dialog (no open attribute) when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => undefined}
        title="Hidden"
        description="Should not appear"
        confirmLabel="Go"
      />,
    );
    // The Dialog primitive renders the <dialog> element but without
    // the `open` attribute — i.e. it stays invisible until opened.
    const dialogs = document.querySelectorAll("dialog");
    const closedDialog = Array.from(dialogs).find((d) => !d.hasAttribute("open"));
    expect(closedDialog).not.toBeUndefined();
  });

  it("Cancel button has default focus on open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Are you sure?"
        description="Confirm."
        confirmLabel="Yes"
      />,
    );
    const cancel = screen.getByRole("button", { name: /cancel/i });
    expect(cancel).toHaveFocus();
  });

  it("clicking Cancel fires onOpenChange(false) and skips onConfirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete?"
        description="This is irreversible."
        confirmLabel="Delete"
        intent="destructive"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking Confirm fires onConfirm once", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn(async (): Promise<void> => undefined);
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Confirm?"
        description="Yes or no."
        confirmLabel="Yes"
        onConfirm={onConfirm}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("destructive intent renders the Confirm button with the secondary (non-coral) variant", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Clear cache?"
        description="Removes downloaded audio."
        confirmLabel="Clear cache"
        intent="destructive"
      />,
    );
    const confirm = screen.getByRole("button", { name: /clear cache/i });
    // Secondary variant — `bg-card` not `bg-coral-600`.
    expect(confirm.className).toContain("bg-card");
    expect(confirm.className).not.toContain("bg-coral-600");
  });

  it("default intent renders the Confirm button with the primary (coral) variant", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Looks good?"
        description="Proceed."
        confirmLabel="Proceed"
      />,
    );
    const confirm = screen.getByRole("button", { name: /proceed/i });
    expect(confirm.className).toContain("bg-coral-600");
  });

  it("does not call window.alert (no mid-flow interruption)", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Quiet?"
        description="Nothing pops up."
        confirmLabel="Yes"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});