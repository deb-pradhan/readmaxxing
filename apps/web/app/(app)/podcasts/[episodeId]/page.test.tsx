/**
 * /podcasts/[episodeId] — Phase E (E.3) StatusPill + honest copy tests.
 *
 * The episode page used to say "This episode is still being produced
 * (reading_doc). Come back in a few minutes." — a guess + raw enum.
 * Phase E replaced it with a StatusPill + "We'll email you when this
 * episode is ready." (D15).
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ episodeId: "ep1" }),
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

vi.mock("@/components/ai/AskChat", () => ({
  AskChat: (): React.JSX.Element => <div data-testid="ask-chat" />,
}));

vi.mock("@/components/player/PlayerBar", () => ({
  PlayerBar: (): React.JSX.Element => <div data-testid="player-bar" />,
}));

function makeEpisodeResponse(episode: unknown): Response {
  return new Response(JSON.stringify({ episode }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/podcasts/[episodeId] (Phase E — E.3)", () => {
  it("renders a StatusPill + 'we'll email you' copy for in-progress episodes (no raw enum)", async () => {
    const episode = {
      id: "ep1",
      title: "Sample Episode",
      audioPath: "",
      durationSeconds: 0,
      status: "producing_audio",
      podcast: { style: "debate", title: "Show" },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/ai/podcasts/ep1") && !url.includes("/transcript")) {
        return makeEpisodeResponse(episode);
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const EpisodePage = (await import("./page")).default;
    render(<EpisodePage />);

    await waitFor(() => {
      expect(document.querySelector('[data-status="rendering"]')).not.toBeNull();
    });
    expect(screen.getByText(/we'll email you when this episode is ready/i)).toBeInTheDocument();
    // The raw enum token must never appear as copy.
    expect(screen.queryByText(/producing_audio/i)).toBeNull();
    // The old "Come back in a few minutes" lie is gone.
    expect(screen.queryByText(/come back in a few minutes/i)).toBeNull();
  });

  it("renders a 'Failed' pill for failed episodes with friendly retry copy", async () => {
    const episode = {
      id: "ep1",
      title: "Failed Episode",
      audioPath: "",
      durationSeconds: 0,
      status: "failed",
      podcast: { style: "debate", title: "Show" },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/ai/podcasts/ep1")) return makeEpisodeResponse(episode);
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const EpisodePage = (await import("./page")).default;
    render(<EpisodePage />);

    await waitFor(() => {
      expect(document.querySelector('[data-status="error"]')).not.toBeNull();
    });
    expect(screen.getByText(/couldn't finish this episode/i)).toBeInTheDocument();
  });
});