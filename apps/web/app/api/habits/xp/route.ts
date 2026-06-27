/**
 * /api/habits/xp — Phase 5.5 XP events + level calculation.
 *
 * - GET  → returns the user's running total (sum of `XpEvent.amount`),
 *   today's XP, daily-goal progress, and the level curve.
 * - POST → append an `XpEvent` (validated via the pure
 *   `calculateXP` from `@readmaxxing/core/habits`). When the action is
 *   `STREAK_MILESTONE` we check eligibility against the current streak
 *   and award the bonus only once per milestone.
 *
 * Privacy: never log raw user text. We log the action, amount, and
 * total only (TESTING.md §8.7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient, type XpSource } from "@readmaxxing/db";
import {
  calculateXP,
  isStreakMilestone,
  XP_ACTION_TO_SOURCE,
  type XPAction,
} from "@readmaxxing/core";
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
  action: z.enum([
    "LISTEN_MINUTE",
    "COMPLETE_DOC",
    "COMPLETE_QUIZ",
    "QUIZ_PERFECT",
    "COMPLETE_PODCAST",
    "DAILY_GOAL_MET",
    "STREAK_MILESTONE",
    "OCR_PAGE",
    "VOICE_TYPING_MINUTE",
  ]),
  quantity: z.number().int().min(1).max(1000).default(1),
  sourceId: z.string().max(200).optional(),
});

const DAILY_GOAL_XP = 20; // matches DAILY_GOAL_MET in the XP table

// Simple level curve: every 200 XP = 1 level. Keeps the math obvious.
function levelFromXp(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  const level = Math.max(1, Math.floor(totalXp / 200) + 1);
  const currentLevelXp = (level - 1) * 200;
  const nextLevelXp = level * 200;
  return { level, currentLevelXp, nextLevelXp };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = localDateKey();
  const startOfToday = new Date(`${today}T00:00:00.000Z`);
  const endOfToday = new Date(`${today}T23:59:59.999Z`);

  const [allEvents, todayEvents] = await Promise.all([
    db().xpEvent.findMany({ where: { userId } }),
    db().xpEvent.findMany({
      where: { userId, createdAt: { gte: startOfToday, lte: endOfToday } },
    }),
  ]);
  const totalXp = allEvents.reduce((s, e) => s + e.amount, 0);
  const todayXp = todayEvents.reduce((s, e) => s + e.amount, 0);
  const level = levelFromXp(totalXp);

  return NextResponse.json({
    totalXp,
    todayXp,
    dailyGoalXp: DAILY_GOAL_XP,
    ...level,
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
    body = PostBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }

  // Streak milestones require a current streak — fetch it for eligibility.
  let streakDays: number | undefined;
  if (body.action === "STREAK_MILESTONE") {
    const streak = await db().streak.findUnique({ where: { userId } });
    streakDays = streak?.currentDays ?? 0;
    if (!isStreakMilestone(streakDays)) {
      return NextResponse.json(
        {
          error: "not_a_milestone",
          message: `Streak of ${streakDays} days doesn't unlock a milestone yet.`,
        },
        { status: 400 },
      );
    }
  }

  const calc = calculateXP({
    action: body.action as XPAction,
    quantity: body.quantity,
    streakDays,
  });
  if (calc.xpAmount <= 0) {
    return NextResponse.json(
      { error: "no_xp_awarded", message: "Action didn't earn any XP." },
      { status: 400 },
    );
  }

  const source: XpSource = calc.source as XpSource;
  const created = await db().xpEvent.create({
    data: {
      userId,
      amount: calc.xpAmount,
      source,
      sourceId: body.sourceId ?? null,
    },
  });

  const totalAgg = await db().xpEvent.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  const totalXp = totalAgg._sum.amount ?? 0;

  log.info({
    event: "habit.xp_awarded",
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    action: body.action,
    amount: calc.xpAmount,
    total_xp: totalXp,
    source,
  });

  return NextResponse.json(
    {
      id: created.id,
      action: body.action,
      amount: calc.xpAmount,
      source,
      multiplierReason: calc.multiplierReason ?? null,
      totalXp,
      level: levelFromXp(totalXp),
    },
    { status: 201 },
  );
}
