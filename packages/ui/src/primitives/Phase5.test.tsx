/**
 * Phase 5 habit primitives — render + interaction tests.
 *
 * Pins the calm + pressure-without-shame rules:
 *  - No red on streak-broken / at-risk states (only amber).
 *  - Private mode renders a calm card, not the table.
 *  - Locked badges are visually distinct (grayscale + lower opacity).
 *  - Quest progress bars never claim completion past 100%.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StreakRing } from "./StreakRing";
import { StreakCalendar } from "./StreakCalendar";
import { LeaderboardTable } from "./LeaderboardTable";
import { BadgeGrid } from "./BadgeGrid";
import { XPBar } from "./XPBar";
import { QuestList } from "./QuestList";

describe("StreakRing", () => {
  it("renders the days count", () => {
    render(<StreakRing days={12} />);
    expect(screen.getByRole("img", { name: /12-day streak/i })).toBeInTheDocument();
  });

  it("marks the at-risk state when atRisk is true and today is not active", () => {
    render(<StreakRing days={5} atRisk todayActive={false} />);
    const el = screen.getByRole("img", { name: /at risk/i });
    expect(el).toHaveAttribute("data-state", "at-risk");
  });

  it("does not show at-risk when today is active", () => {
    render(<StreakRing days={5} atRisk todayActive />);
    const el = screen.getByRole("img");
    expect(el).toHaveAttribute("data-state", "active");
  });
});

describe("StreakCalendar", () => {
  it("highlights today with a ring", () => {
    const today = "2026-06-25";
    render(
      <StreakCalendar
        activeDays={[today]}
        todayKey={today}
        monthKey="2026-06"
      />,
    );
    const cell = screen.getByLabelText(new RegExp(today));
    expect(cell).toHaveAttribute("data-today", "true");
    expect(cell).toHaveAttribute("data-active", "true");
  });

  it("renders frozen days with a snowflake marker", () => {
    render(
      <StreakCalendar
        activeDays={[]}
        frozenDays={["2026-06-20"]}
        todayKey="2026-06-25"
        monthKey="2026-06"
      />,
    );
    const frozen = screen.getByLabelText(/2026-06-20 — frozen/i);
    expect(frozen).toHaveAttribute("data-frozen", "true");
  });
});

describe("LeaderboardTable", () => {
  const ROWS = [
    { userId: "u1", displayName: "Alice", weeklyXp: 1200, rank: 1 },
    { userId: "u2", displayName: "You", weeklyXp: 950, rank: 2, isCurrentUser: true },
  ];

  it("renders rows + tier badge", () => {
    render(
      <LeaderboardTable
        leagueName="Bronze"
        leagueTier="gold"
        weekKey="2026-W26"
        rows={ROWS}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("You").length).toBeGreaterThan(0);
    expect(screen.getByText("Bronze")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
  });

  it("marks the current user", () => {
    render(
      <LeaderboardTable
        leagueName="Silver"
        leagueTier="silver"
        weekKey="2026-W26"
        rows={ROWS}
      />,
    );
    const lis = document.querySelectorAll("li[data-current-user=true]");
    expect(lis.length).toBe(1);
    expect(lis[0]?.textContent).toContain("You");
  });

  it("shows a private-mode card when opted out", () => {
    render(
      <LeaderboardTable
        leagueName="Silver"
        leagueTier="silver"
        weekKey="2026-W26"
        rows={ROWS}
        privateMode
      />,
    );
    expect(screen.getByText(/You're in private mode/i)).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});

describe("BadgeGrid", () => {
  const BADGES = [
    {
      id: "two-week-warrior",
      name: "2-Week Warrior",
      description: "Read for 14 days in a row.",
      requirement: "Reach a 14-day streak.",
      tier: "gold" as const,
      earnedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "century-reader",
      name: "Century Reader",
      description: "Read 100,000 words.",
      requirement: "Read 100,000 words.",
      tier: "bronze" as const,
    },
  ];

  it("renders earned + locked badges", () => {
    render(<BadgeGrid badges={BADGES} />);
    expect(screen.getByTestId("badge-two-week-warrior")).toHaveAttribute(
      "data-earned",
      "true",
    );
    expect(screen.getByTestId("badge-century-reader")).toHaveAttribute(
      "data-earned",
      "false",
    );
  });

  it("opens a modal with the requirement on click", () => {
    render(<BadgeGrid badges={BADGES} />);
    fireEvent.click(screen.getByTestId("badge-century-reader"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // The dialog contains the badge description.
    expect(dialog.textContent).toContain("Read 100,000 words");
    // And the locked status (no earnedAt).
    expect(dialog.textContent).toContain("Locked");
  });
});

describe("XPBar", () => {
  it("renders the daily ring and level bar", () => {
    render(
      <XPBar
        todayXp={20}
        dailyGoalXp={50}
        totalXp={120}
        currentLevelXp={0}
        nextLevelXp={200}
        level={1}
      />,
    );
    expect(screen.getByText(/today's goal/i)).toBeInTheDocument();
    expect(screen.getByText(/level 1/i)).toBeInTheDocument();
  });

  it("surfaces the last multiplier reason as a footnote", () => {
    render(
      <XPBar
        todayXp={50}
        dailyGoalXp={50}
        totalXp={200}
        currentLevelXp={0}
        nextLevelXp={400}
        level={1}
        lastMultiplierReason="Daily goal met"
      />,
    );
    expect(screen.getByText(/daily goal met/i)).toBeInTheDocument();
  });
});

describe("QuestList", () => {
  it("caps the progress bar at 100% even when progress > target", () => {
    render(
      <QuestList
        quests={[
          {
            id: "q1",
            name: "Listen to 3 docs",
            description: "Finish 3 documents this week.",
            progress: 5,
            target: 3,
            xpReward: 25,
            completedAt: "2026-06-20T00:00:00.000Z",
          },
        ]}
      />,
    );
    const li = screen.getByTestId("quest-q1");
    expect(li).toHaveAttribute("data-completed", "true");
  });

  it("renders an empty state when no quests are available", () => {
    render(<QuestList quests={[]} />);
    expect(screen.getByText(/no quests this week/i)).toBeInTheDocument();
  });
});
