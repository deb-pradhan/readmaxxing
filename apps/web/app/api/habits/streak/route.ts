/**
 * /api/habits/streak — Phase 5.5 habit layer.
 *
 * - GET  → returns the current streak, freezes, calendar, and weekly
 *   freeze-window for the user.
 * - POST → records a listening completion. The body is
 *   `{ activeToday?: boolean, todayKey?: string }`. The route loads
 *   the current `Streak` row, runs the pure
 *   `calculateCurrentStreak` from `@readmaxxing/core/habits`, and
 *   upserts the result.
 *
 * The Prisma `Streak.lastActiveAt` column is a `DateTime` — the
 * habit functions use `DateKey` (`YYYY-MM-DD`) strings. We map
 * between the two so the BFF owns the date-handling boundary.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import { calculateCurrentStreak, daysUntilFreezeReset, mondayOf, type DateKey } from "@readmaxxing/core";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";
import { localDateKey } from "@/lib/habits/date-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const PostBody = z.object({
  activeToday: z.boolean().default(true),
  todayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

interface CalendarJSON {
  [date: string]: boolean;
}

/** Prisma returns a `DateTime` for `lastActiveAt`; the engine wants a string. */
function dateToKey(d: Date | null | undefined): DateKey | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}
function keyToDate(k: DateKey | null | undefined): Date | null {
  if (!k) return null;
  return new Date(`${k}T00:00:00.000Z`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const streak = await db().streak.findUnique({ where: { userId } });
  const today = localDateKey();
  const weekStart = mondayOf(today);
  const daysToReset = daysUntilFreezeReset(weekStart);
  const calendar = (streak?.calendar ?? {}) as CalendarJSON;

  return NextResponse.json({
    currentDays: streak?.currentDays ?? 0,
    longestDays: streak?.longestDays ?? 0,
    freezesAvailable: streak?.freezesAvailable ?? 1,
    freezesUsedThisWeek: streak?.freezesUsedThisWeek ?? 0,
    lastActiveDate: dateToKey(streak?.lastActiveAt),
    recoveredAt: streak?.recoveredAt ? streak.recoveredAt.toISOString().slice(0, 10) : null,
    calendar: Object.keys(calendar).filter((k) => calendar[k]),
    weekStart,
    daysToReset,
    todayKey: today,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await request.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }

  const baseFields = {
    request_id: requestId,
    user_id_hash: userIdHash(userId),
  };

  const existing = await db().streak.findUnique({ where: { userId } });
  const today = body.todayKey ?? localDateKey();
  const result = calculateCurrentStreak({
    state: existing
      ? {
          currentDays: existing.currentDays,
          longestDays: existing.longestDays,
          freezesAvailable: existing.freezesAvailable,
          freezesUsedThisWeek: existing.freezesUsedThisWeek,
          lastActiveDate: dateToKey(existing.lastActiveAt),
          recoveredAt: dateToKey(existing.recoveredAt),
        }
      : null,
    today,
    activeToday: body.activeToday,
  });

  const calendar: CalendarJSON = (existing?.calendar ?? {}) as CalendarJSON;
  if (body.activeToday && today) {
    calendar[today] = true;
  }

  const upserted = await db().streak.upsert({
    where: { userId },
    create: {
      userId,
      currentDays: result.currentStreak,
      longestDays: result.longestDays,
      freezesAvailable: result.freezesAvailable,
      freezesUsedThisWeek: result.freezesUsedThisWeek,
      lastActiveAt: keyToDate(result.lastActiveDate),
      recoveredAt: keyToDate(result.recoveredAt),
      calendar: calendar as unknown as object,
    },
    update: {
      currentDays: result.currentStreak,
      longestDays: result.longestDays,
      freezesAvailable: result.freezesAvailable,
      freezesUsedThisWeek: result.freezesUsedThisWeek,
      lastActiveAt: keyToDate(result.lastActiveDate),
      recoveredAt: keyToDate(result.recoveredAt),
      calendar: calendar as unknown as object,
    },
  });

  // Emit the right event per the engine's message.
  if (result.didFreeze) {
    log.info({
      ...baseFields,
      event: "habit.streak_freeze_used",
      freezes_remaining: result.freezesAvailable,
      missed_date: dateToKey(existing?.lastActiveAt),
    });
  } else if (result.didRecover) {
    log.info({
      ...baseFields,
      event: "habit.streak_recovered",
      recovered_days: result.currentStreak,
    });
  } else if (result.message === "incremented") {
    log.info({
      ...baseFields,
      event: "habit.streak_increment",
      current_days: result.currentStreak,
      longest_days: result.longestDays,
    });
  }

  return NextResponse.json(
    {
      currentDays: upserted.currentDays,
      longestDays: upserted.longestDays,
      freezesAvailable: upserted.freezesAvailable,
      freezesUsedThisWeek: upserted.freezesUsedThisWeek,
      lastActiveDate: dateToKey(upserted.lastActiveAt),
      recoveredAt: dateToKey(upserted.recoveredAt),
      didFreeze: result.didFreeze,
      didRecover: result.didRecover,
      message: result.message,
      todayKey: today,
    },
    { status: 200 },
  );
}
