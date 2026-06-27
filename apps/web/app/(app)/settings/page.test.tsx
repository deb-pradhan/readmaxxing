/**
 * /settings — Phase E (E.4) tests.
 *
 * Audit D finding: settings used `alert()` with dev copy on Log out,
 * Export, and Clear-cache actions. Phase E replaced every `alert()`
 * with a `ConfirmDialog`. These tests pin that:
 *  - No `alert()` is invoked at module import or render.
 *  - Clicking Log out / Export / Clear-cache opens the corresponding
 *    ConfirmDialog (via the native `<dialog>` body mounting).
 *  - Cancel button receives default focus.
 *  - Destructive Confirm buttons use the secondary (non-coral) variant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }) as unknown as URLSearchParams,
}));

vi.mock("@/components/shared/AppHeader", () => ({
  AppHeader: ({ children }: { children?: React.ReactNode }): React.JSX.Element => (
    <header>{children}</header>
  ),
}));

vi.mock("@/components/shared/ThemeSwitcher", () => ({
  ThemeSwitcher: (): React.JSX.Element => <div data-testid="theme-switcher" />,
}));

function makePrefsResponse(): Response {
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("/settings (Phase E — E.4)", () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(async () => makePrefsResponse()) as unknown as typeof fetch;
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("does NOT call window.alert during render or normal interaction", async () => {
    const SettingsPage = (await import("./page")).default;
    render(<SettingsPage />);
    // Wait for any useEffect to settle. Phase F (F.2) — the page now
    // has TWO "Settings" text nodes (the Eyebrow and the Display-1
    // h1). Scope the assertion to the h1 so we don't pin the wrong
    // element.
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("clicking 'Log out' opens a ConfirmDialog with destructive Confirm button", async () => {
    const SettingsPage = (await import("./page")).default;
    const { container } = render(<SettingsPage />);
    // The trigger button is the one inside the Account section.
    const trigger = Array.from(
      container.querySelectorAll('section[aria-label="Account"] button'),
    ).find((b) => b.textContent?.trim() === "Log out") as HTMLButtonElement;
    fireEvent.click(trigger);
    // The ConfirmDialog title mounts inside the document.
    expect(await screen.findByText(/log out of readmaxxing\?/i)).toBeInTheDocument();
    // The Confirm button is destructive (secondary, non-coral).
    const dialog = (await screen.findByText(/log out of readmaxxing\?/i)).closest(
      "dialog",
    ) as HTMLElement;
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const confirm = buttons.find((b) => b.textContent?.trim() === "Log out") as HTMLButtonElement;
    expect(confirm.className).toContain("bg-card");
    expect(confirm.className).not.toContain("bg-coral-600");
  });

  it("clicking 'Clear local IndexedDB cache' opens a destructive ConfirmDialog", async () => {
    const SettingsPage = (await import("./page")).default;
    render(<SettingsPage />);
    const trigger = screen.getByRole("button", { name: /clear local indexeddb cache/i });
    fireEvent.click(trigger);
    expect(await screen.findByText(/clear local indexeddb cache\?/i)).toBeInTheDocument();
    // No alert fired.
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("clicking 'Download my data' opens a friendly 'coming soon' ConfirmDialog", async () => {
    const SettingsPage = (await import("./page")).default;
    render(<SettingsPage />);
    const trigger = screen.getByRole("button", { name: /download my data/i });
    fireEvent.click(trigger);
    expect(await screen.findByText(/data export isn't available yet/i)).toBeInTheDocument();
    // No alert fired.
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("Cancel button has default focus on the Log out dialog", async () => {
    const SettingsPage = (await import("./page")).default;
    const { container } = render(<SettingsPage />);
    const trigger = Array.from(
      container.querySelectorAll('section[aria-label="Account"] button'),
    ).find((b) => b.textContent?.trim() === "Log out") as HTMLButtonElement;
    fireEvent.click(trigger);
    const dialog = (await screen.findByText(/log out of readmaxxing\?/i)).closest(
      "dialog",
    ) as HTMLElement;
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const cancel = buttons.find((b) => b.textContent?.trim() === "Cancel") as HTMLButtonElement;
    expect(cancel).toHaveFocus();
  });
});