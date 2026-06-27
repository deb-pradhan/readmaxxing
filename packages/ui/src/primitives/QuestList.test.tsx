/**
 * QuestList primitive tests — Phase F (F.3) mono numerals.
 *
 * Per DESIGN-SYSTEM §25.2 + §25.8: reward values (XP) use mono +
 * tabular numerals; progress/target counts read mono.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { QuestList } from "./QuestList";

const QUESTS = [
  { id: "q1", name: "Read 10 minutes", description: "x", progress: 4, target: 10, xpReward: 25 },
  { id: "q2", name: "Finish one doc", description: "y", progress: 1, target: 1, xpReward: 100 },
];

describe("QuestList (Phase F — F.3 mono numerals)", () => {
  it("XP reward value uses font-mono + tabular-nums", () => {
    const { container } = render(<QuestList quests={QUESTS} />);
    const xpBadges = Array.from(container.querySelectorAll<HTMLElement>("span.font-mono.tabular-nums"));
    const text = xpBadges.map((el) => el.textContent).join(" ");
    expect(text).toMatch(/\+25 XP/);
    expect(text).toMatch(/\+100 XP/);
  });

  it("progress / target readouts use font-mono + tabular-nums", () => {
    const { container } = render(<QuestList quests={QUESTS} />);
    const lines = Array.from(container.querySelectorAll<HTMLElement>("p.font-mono.tabular-nums"));
    const text = lines.map((el) => el.textContent).join(" ");
    expect(text).toMatch(/4 \/ 10/);
    expect(text).toMatch(/1 \/ 1/);
  });

  it("renders the empty-state message when there are no quests", () => {
    const { container } = render(<QuestList quests={[]} />);
    expect(container.textContent).toMatch(/no quests this week/i);
  });
});