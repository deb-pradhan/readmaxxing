/**
 * LeaderboardTable primitive tests — Phase F (F.3) mono numerals.
 *
 * Per DESIGN-SYSTEM §25.2 + §25.8: row position numbers use mono
 * + tabular numerals so the rank doesn't jitter as it ticks. The XP
 * value also reads mono.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { LeaderboardTable } from "./LeaderboardTable";

const ROWS = [
  { userId: "u1", displayName: "Alice", weeklyXp: 1240, rank: 1 },
  { userId: "u2", displayName: "Bob", weeklyXp: 900, rank: 2, isCurrentUser: true },
  { userId: "u3", displayName: "Cara", weeklyXp: 540, rank: 3 },
];

describe("LeaderboardTable (Phase F — F.3 mono numerals)", () => {
  it("row position number uses font-mono + tabular-nums", () => {
    const { container } = render(
      <LeaderboardTable
        leagueName="Bronze"
        leagueTier="bronze"
        weekKey="2026-W26"
        rows={ROWS}
      />,
    );
    const rankEl = container.querySelector<HTMLElement>("li:first-child span:first-child");
    expect(rankEl?.textContent).toBe("#1");
    expect(rankEl).toHaveClass("font-mono");
    expect(rankEl).toHaveClass("tabular-nums");
  });

  it("weekly XP value uses font-mono + tabular-nums", () => {
    const { container } = render(
      <LeaderboardTable
        leagueName="Bronze"
        leagueTier="bronze"
        weekKey="2026-W26"
        rows={ROWS}
      />,
    );
    const xpEls = Array.from(container.querySelectorAll<HTMLElement>("span.font-mono.tabular-nums"));
    const xpText = xpEls.map((el) => el.textContent).join(" ");
    expect(xpText).toMatch(/1,240/);
  });

  it("renders a private-mode card when privateMode is true", () => {
    const { container } = render(
      <LeaderboardTable
        leagueName="Bronze"
        leagueTier="bronze"
        weekKey="2026-W26"
        rows={ROWS}
        privateMode
      />,
    );
    expect(
      container.querySelector('section[aria-label="Leaderboard private mode"]'),
    ).not.toBeNull();
  });
});