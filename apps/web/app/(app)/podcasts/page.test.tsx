/**
 * /podcasts — Phase E (E.3) StatusPill tests.
 *
 * Audit D finding: the producing card leaked the raw enum token
 * (`Status: reading_doc`) and surfaced no honest copy. Phase E
 * routed the enum through StatusPill and replaced the status line
 * with "We'll email you when this episode is ready."
 *
 * These tests pin the contract:
 *  - In-progress episodes render a `<StatusPill>` (data-status) inside
 *    the producing card.
 *  - The card body never contains the literal enum token
 *    (no `Status: reading_doc`).
 *  - The honest email-notification copy is present.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";

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

vi.mock("@/components/ai/PodcastCreator", () => ({
  PodcastCreator: (): React.JSX.Element => <div data-testid="podcast-creator" />,
  PODCAST_STYLES: ["podcast", "late_night", "debate", "lecture"],
}));

function makeEpisodesResponse(episodes: unknown[]): Response {
  return new Response(
    JSON.stringify({ episodes, has_more: false, page: 1, chunk_size: 7, total: episodes.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("/podcasts (Phase E — E.3)", () => {
  beforeEach(() => {
    // jsdom localStorage guards; safe.
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("renders a StatusPill for in-progress episodes (no raw enum token)", async () => {
    const episodes = [
      {
        id: "ep1",
        podcastId: "pod1",
        title: "Episode One — still producing",
        audioPath: "",
        durationSeconds: 0,
        status: "reading_doc",
        createdAt: new Date().toISOString(),
        completedAt: null,
        podcast: { id: "pod1", style: "debate", title: "Show" },
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/ai/podcasts")) return makeEpisodesResponse(episodes);
      if (url.includes("/api/documents")) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const PodcastsPage = (await import("./page")).default;
    render(<PodcastsPage />);

    await waitFor(() => {
      // StatusPill mounts with `data-status` attribute.
      expect(document.querySelector('[data-status="rendering"]')).not.toBeNull();
    });
    // The raw enum must never appear as copy.
    expect(screen.queryByText(/Status: reading_doc/i)).toBeNull();
    expect(screen.queryByText(/Status: writing_script/i)).toBeNull();
    // Honest copy line.
    expect(screen.getByText(/we'll email you when this episode is ready/i)).toBeInTheDocument();
  });

  it("renders a 'Failed' pill for failed episodes", async () => {
    const episodes = [
      {
        id: "ep2",
        podcastId: "pod1",
        title: "Episode Two — failed",
        audioPath: "",
        durationSeconds: 0,
        status: "failed",
        createdAt: new Date().toISOString(),
        completedAt: null,
        podcast: { id: "pod1", style: "debate", title: "Show" },
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/ai/podcasts")) return makeEpisodesResponse(episodes);
      if (url.includes("/api/documents")) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const PodcastsPage = (await import("./page")).default;
    render(<PodcastsPage />);
    // Use the data-status attribute on the StatusPill — unique.
    await waitFor(() => {
      expect(document.querySelector('[data-status="error"]')).not.toBeNull();
    });
  });
});