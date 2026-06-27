"use client";

/**
 * Leaderboard — placeholder card. The full table primitive lives in
 * `LeaderboardTable`.
 */

import * as React from "react";
import { cn } from "../cn";

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  xp: number;
  rank: number;
}

export interface LeaderboardProps {
  leagueName: string;
  entries: LeaderboardEntry[];
  className?: string;
}

export function Leaderboard({ leagueName, entries, className }: LeaderboardProps): React.JSX.Element {
  return (
    <section
      aria-label={`${leagueName} leaderboard`}
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-4",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{leagueName}</h3>
        <span className="text-xs text-ink-muted">Weekly</span>
      </header>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">No entries yet — be the first.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {entries.map((e) => (
            <li key={e.userId} className="flex items-center justify-between">
              <span className="tabular w-6 text-ink-muted">#{e.rank}</span>
              <span className="flex-1 truncate px-2">{e.displayName}</span>
              <span className="tabular text-ink-muted">{e.xp.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-ink-faint">
        Leaderboards are opt-out. Toggle privacy in Settings.
      </p>
    </section>
  );
}