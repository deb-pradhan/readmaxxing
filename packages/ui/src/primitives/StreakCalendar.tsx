"use client";

/**
 * StreakCalendar — monthly 5×7 grid showing active / frozen / missed
 * days.
 *
 * Layout: 5 rows × 7 columns (weeks). Active days show a filled
 * coral dot. Frozen days show a snowflake. Missed days are empty.
 * The current day is highlighted with a colored border.
 */

import * as React from "react";
import { cn } from "../cn";

export interface StreakCalendarDay {
  /** ISO date key `YYYY-MM-DD` in the user's local timezone. */
  date: string;
  /** Whether the user hit the daily goal. */
  active: boolean;
  /** Whether a streak freeze covered this day. */
  frozen?: boolean;
}

export interface StreakCalendarProps {
  /** Date keys (`YYYY-MM-DD`) the user hit the daily goal. */
  activeDays: string[];
  /** Date keys the user got a streak freeze on. */
  frozenDays?: string[];
  /** Today's local date key. Defaults to `new Date()` (local). */
  todayKey?: string;
  /** Month to display. Defaults to today's month. */
  monthKey?: string; // `YYYY-MM`
  /** Local timezone, e.g. `America/Los_Angeles`. Display only. */
  timezone?: string;
  className?: string;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StreakCalendar({
  activeDays,
  frozenDays = [],
  todayKey,
  monthKey,
  timezone,
  className,
}: StreakCalendarProps): React.JSX.Element {
  const today = todayKey ?? toIsoDate(new Date());
  const month = monthKey ?? today.slice(0, 7);
  const active = new Set(activeDays);
  const frozen = new Set(frozenDays);

  const grid = buildGrid(month, today);

  return (
    <section
      aria-label="Streak calendar"
      data-month={month}
      className={cn("rounded-lg border border-border-subtle bg-card p-4 shadow-sm", className)}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-md font-semibold">{monthLabel(month)}</h3>
        {timezone ? (
          <span className="text-xs text-ink-faint">{timezone}</span>
        ) : null}
      </header>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ink-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
        {grid.map(({ date, inMonth }, idx) => {
          if (!inMonth) {
            return <div key={idx} className="aspect-square" />;
          }
          const isActive = active.has(date);
          const isFrozen = frozen.has(date);
          const isToday = date === today;
          return (
            <div
              key={date}
              aria-label={dateLabel(date, isActive, isFrozen, isToday)}
              data-active={isActive}
              data-frozen={isFrozen}
              data-today={isToday}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs tabular",
                isActive
                  ? "bg-coral-bg text-white"
                  : isFrozen
                    ? "bg-info-soft text-info"
                    : "bg-card-muted text-ink-muted",
                isToday && "ring-2 ring-coral-bg ring-offset-1",
              )}
            >
              {date.slice(8, 10)}
              {isFrozen ? (
                <span aria-hidden className="absolute -bottom-0.5 right-0.5 text-[10px]">
                  ❄
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface GridCell {
  date: string;
  inMonth: boolean;
}

function buildGrid(month: string, today: string): GridCell[] {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const weekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const cells: GridCell[] = [];
  for (let i = 0; i < weekday; i++) cells.push({ date: "", inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, m - 1, d));
    const iso = dt.toISOString().slice(0, 10);
    cells.push({ date: iso, inMonth: true });
  }
  while (cells.length < 35) cells.push({ date: "", inMonth: false });
  return cells;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(m) - 1, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function dateLabel(date: string, active: boolean, frozen: boolean, today: boolean): string {
  const parts: string[] = [date];
  if (today) parts.push("today");
  if (active) parts.push("active");
  if (frozen) parts.push("frozen (streak freeze)");
  return parts.join(" — ");
}