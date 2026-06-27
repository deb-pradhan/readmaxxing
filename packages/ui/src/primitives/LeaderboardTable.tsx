"use client";

/**
 * LeaderboardTable — weekly league table.
 *
 * Pressure-without-shame: the current user is highlighted with a
 * subtle coral background — no jarring color, no anxiety red.
 * The `privateMode` flag swaps the table for a calm "You're in
 * private mode" card (one tap to rejoin).
 */

import * as React from "react";
import { cn } from "../cn";

export type LeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  weeklyXp: number;
  rank: number;
  /** True iff this is the current user. */
  isCurrentUser?: boolean;
}

export interface LeaderboardTableProps {
  leagueName: string;
  leagueTier: LeagueTier;
  weekKey: string; // e.g. "2026-W26"
  rows: LeaderboardRow[];
  /** When true, show the "private mode" card instead of the table. */
  privateMode?: boolean;
  /** Optional handler to rejoin leaderboards. */
  onJoinLeaderboards?: () => void;
  className?: string;
}

// Tier pills pull from the brand palette (DESIGN-SYSTEM §14.4).
const TIER_COLOR: Record<LeagueTier, string> = {
  bronze: "bg-coral-soft text-coral-text",
  silver: "bg-card-muted text-ink",
  gold: "bg-butter-bg text-butter-text",
  platinum: "bg-lavender-bg text-lavender-text",
  diamond: "bg-mint-bg text-mint-text",
};

export function LeaderboardTable({
  leagueName,
  leagueTier,
  weekKey,
  rows,
  privateMode = false,
  onJoinLeaderboards,
  className,
}: LeaderboardTableProps): React.JSX.Element {
  if (privateMode) {
    return (
      <section
        aria-label="Leaderboard private mode"
        className={cn(
          "rounded-lg border border-border-subtle bg-card p-5 shadow-sm",
          className,
        )}
      >
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Leaderboards</h3>
          <span className="text-xs text-ink-muted">Private mode</span>
        </header>
        <p className="text-sm text-ink-muted">
          You're in private mode — your XP and rank aren't visible to anyone.
          Rejoin any time.
        </p>
        {onJoinLeaderboards ? (
          <button
            type="button"
            onClick={onJoinLeaderboards}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-card-muted focus-visible:shadow-focus"
          >
            Rejoin leaderboards
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label={`${leagueName} leaderboard`}
      data-league-tier={leagueTier}
      data-week={weekKey}
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-4 shadow-sm",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{leagueName}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              TIER_COLOR[leagueTier],
            )}
          >
            {leagueTier[0]!.toUpperCase() + leagueTier.slice(1)}
          </span>
        </div>
        <span className="text-xs text-ink-muted">{weekKey}</span>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No entries yet — be the first.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.userId}
              data-current-user={Boolean(row.isCurrentUser)}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5",
                row.isCurrentUser
                  ? "bg-coral-soft"
                  : "hover:bg-card-muted",
              )}
            >
              <span className="tabular w-6 text-ink-muted">#{row.rank}</span>
              {row.avatarUrl ? (
                <img
                  src={row.avatarUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-[6px]"
                />
              ) : (
                <div
                  aria-hidden
                  className="h-6 w-6 rounded-[6px] bg-card-muted"
                />
              )}
              <span className="flex-1 truncate">
                {row.displayName}
                {row.isCurrentUser ? (
                  <span className="ml-2 text-xs text-coral-text">You</span>
                ) : null}
              </span>
              <span className="tabular text-ink-muted">
                {row.weeklyXp.toLocaleString()} XP
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}