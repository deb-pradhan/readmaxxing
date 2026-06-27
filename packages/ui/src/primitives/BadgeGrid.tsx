"use client";

/**
 * BadgeGrid — earned + locked badges with a click-to-inspect modal.
 */

import * as React from "react";
import { cn } from "../cn";

export type BadgeTier = "bronze" | "silver" | "gold";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  /** Free-text requirement — e.g. "Reach a 100-day streak". */
  requirement: string;
  tier: BadgeTier;
  /** When set, the user has earned this badge. */
  earnedAt?: string;
  /** Optional URL to a small icon. */
  iconUrl?: string;
}

export interface BadgeGridProps {
  badges: BadgeDefinition[];
  className?: string;
}

const TIER_STYLE: Record<BadgeTier, { ring: string; label: string; chip: string }> = {
  bronze: {
    ring: "ring-coral-bg",
    label: "text-coral-text",
    chip: "bg-coral-soft text-coral-text",
  },
  silver: {
    ring: "ring-ink-muted",
    label: "text-ink",
    chip: "bg-card-muted text-ink",
  },
  gold: {
    ring: "ring-warning",
    label: "text-warning",
    chip: "bg-warning-soft text-warning",
  },
};

export function BadgeGrid({ badges, className }: BadgeGridProps): React.JSX.Element {
  const [active, setActive] = React.useState<BadgeDefinition | null>(null);

  return (
    <section
      aria-label="Badges"
      className={cn("rounded-lg border border-border-subtle bg-card p-4 shadow-sm", className)}
    >
      <header className="mb-3">
        <h3 className="text-lg font-semibold">Badges</h3>
        <p className="text-xs text-ink-muted">
          Earned milestones with identity names — pick up where you left off to level up.
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((b) => {
          const earned = Boolean(b.earnedAt);
          const style = TIER_STYLE[b.tier];
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setActive(b)}
                data-testid={`badge-${b.id}`}
                data-earned={earned}
                data-tier={b.tier}
                aria-label={`${b.name} — ${earned ? "earned" : "locked"}`}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors duration-fast",
                  earned
                    ? `border-border bg-card-muted ${style.ring} ring-1`
                    : "border-border-subtle bg-card opacity-60 grayscale",
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold",
                    earned ? style.chip : "bg-card-muted text-ink-faint",
                  )}
                  aria-hidden
                >
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={cn("text-xs font-medium", earned ? "text-ink" : "text-ink-muted")}>
                  {b.name}
                </span>
                <span className={cn("text-[10px]", style.label)}>
                  {b.tier[0]!.toUpperCase() + b.tier.slice(1)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {active ? (
        <BadgeModal badge={active} onClose={() => setActive(null)} />
      ) : null}
    </section>
  );
}

function BadgeModal({
  badge,
  onClose,
}: {
  badge: BadgeDefinition;
  onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`${badge.name} details`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border-subtle bg-card p-5 shadow-xl"
      >
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{badge.name}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted hover:bg-card-muted focus-visible:shadow-focus"
          >
            ×
          </button>
        </header>
        <p className="text-sm text-ink">{badge.description}</p>
        <dl className="mt-3 space-y-1 text-xs text-ink-muted">
          <div className="flex justify-between">
            <dt>Tier</dt>
            <dd className="capitalize text-ink">{badge.tier}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Requirement</dt>
            <dd className="text-ink">{badge.requirement}</dd>
          </div>
          {badge.earnedAt ? (
            <div className="flex justify-between">
              <dt>Earned</dt>
              <dd className="text-ink">{new Date(badge.earnedAt).toLocaleDateString()}</dd>
            </div>
          ) : (
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd className="text-ink-muted">Locked</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-coral-bg px-3 py-1.5 text-sm font-medium text-white focus-visible:shadow-focus"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}