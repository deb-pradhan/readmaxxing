"use client";

/**
 * QuestList — weekly mini-quests with progress bars.
 */

import * as React from "react";
import { cn } from "../cn";

export interface Quest {
  id: string;
  name: string;
  description: string;
  /** Current progress. */
  progress: number;
  /** Target to complete. */
  target: number;
  /** XP awarded on completion. */
  xpReward: number;
  /** Optional bonus reason. */
  bonusReason?: string;
  /** When set, the user has completed the quest. */
  completedAt?: string;
}

export interface QuestListProps {
  quests: Quest[];
  className?: string;
}

export function QuestList({ quests, className }: QuestListProps): React.JSX.Element {
  return (
    <section
      aria-label="Weekly quests"
      className={cn("rounded-lg border border-border-subtle bg-card p-4 shadow-sm", className)}
    >
      <header className="mb-3">
        <h3 className="text-lg font-semibold">Weekly quests</h3>
        <p className="text-xs text-ink-muted">
          Short goals inside your long-term streak — finish for bonus XP.
        </p>
      </header>
      {quests.length === 0 ? (
        <p className="text-sm text-ink-muted">No quests this week — check back on Monday.</p>
      ) : (
        <ul className="space-y-3">
          {quests.map((q) => {
            const pct = Math.min(1, Math.max(0, q.progress / Math.max(1, q.target)));
            const done = Boolean(q.completedAt);
            return (
              <li
                key={q.id}
                data-testid={`quest-${q.id}`}
                data-completed={done}
                className={cn(
                  "rounded-md border p-3",
                  done ? "border-coral-bg bg-coral-soft" : "border-border-subtle bg-card",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{q.name}</p>
                  <span
                    title={q.bonusReason ?? `+${q.xpReward} XP`}
                    className="rounded-full bg-card-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                  >
                    +{q.xpReward} XP
                  </span>
                </div>
                <p className="mb-2 text-xs text-ink-muted">{q.description}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-coral-bg"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs tabular text-ink-muted">
                  {q.progress.toLocaleString()} / {q.target.toLocaleString()}
                  {done ? " · Complete" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}