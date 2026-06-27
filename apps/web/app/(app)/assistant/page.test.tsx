/**
 * /assistant page — Phase E (E.1) honesty tests.
 *
 * Audit D finding: the assistant page greeted every visitor by name
 * (\"Hi, Hanna!\") and fabricated activity stats (\"two long docs
 * today\"). Both were removed in E.1.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/components/assistant/VoiceInput", () => ({
  VoiceInput: (): React.JSX.Element => <div data-testid="voice-input" />,
}));

vi.mock("@/components/assistant/VoiceOutput", () => ({
  VoiceOutput: (): React.JSX.Element => <div data-testid="voice-output" />,
}));

describe("/assistant (Phase E — E.1)", () => {
  it("does NOT render the fabricated greeting 'Hi, Hanna!'", async () => {
    const AssistantPage = (await import("./page")).default;
    render(<AssistantPage />);
    expect(screen.queryByText(/hi,? hanna/i)).toBeNull();
  });

  it("does NOT render the invented 'two long docs' activity line", async () => {
    const AssistantPage = (await import("./page")).default;
    render(<AssistantPage />);
    expect(screen.queryByText(/two long docs/i)).toBeNull();
    expect(screen.queryByText(/you opened/i)).toBeNull();
  });

  it("renders a real, action-led empty state with copy-stable chips", async () => {
    const AssistantPage = (await import("./page")).default;
    const { container } = render(<AssistantPage />);
    // The hero now invites the first action — no fabrication.
    expect(screen.getByText(/ask by voice or text/i)).toBeInTheDocument();
    // The empty-state chips (visible at the top of the page) are
    // unchanged — copy-stable, no pseudo-personalisation.
    const hero = container.querySelector('section[aria-label="AI assistant welcome"]') as HTMLElement;
    expect(hero.textContent).toMatch(/Catch me up/);
    expect(hero.textContent).toMatch(/Quiz me/);
    expect(hero.textContent).toMatch(/Continue the show/);
  });

  it("hands-free mode label no longer leaks internal 'debounce' jargon", async () => {
    const AssistantPage = (await import("./page")).default;
    render(<AssistantPage />);
    expect(screen.queryByText(/with debounce/i)).toBeNull();
    expect(screen.getByText(/hands-free mode/i)).toBeInTheDocument();
  });
});