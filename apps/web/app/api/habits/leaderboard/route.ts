/**
 * /api/habits/leaderboard — Phase 5.5 weekly league.
 *
 * - GET → returns the current week's league (Bronze → Diamond), the
 *   user's `LeaderboardEntry` (or null if not yet computed), and the
 *   top-N entries. The `Consent.kind = "leaderboards"` row drives the
 *   private-mode banner (TESTING.md §2.14 #4).
 * - The weekly cron that recomputes leagues is documented as a
 *   Railway-scheduler follow-up (per the brief). This route computes a
 *   best-effort league on-demand from `XpEvent` rows in the current
 *   ISO week so a fresh deploy still shows a leaderboard.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";
import { localDateKey } from "@/lib/habits/date-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const TIERS: Array<{ tier: number; name: string; minXp: number; maxXp: number }> = [
  { tier: 0, name: "Bronze", minXp: 0, maxXp: 50 },
  { tier: 1, name: "Silver", minXp: 50, maxXp: 150 },
  { tier: 2, name: "Gold", minXp: 150, maxXp: 300 },
  { tier: 3, name: "Platinum", minXp: 300, maxXp: 500 },
  { tier: 4, name: "Diamond", minXp: 500, maxXp: Number.POSITIVE_INFINITY },
];

function tierForXp(xp: number): { tier: number; name: string } {
  for (const t of TIERS) {
    if (xp >= t.minXp && xp < t.maxXp) return { tier: t.tier, name: t.name };
  }
  return { tier: 0, name: "Bronze" };
}

function isoWeekKey(d: Date = new Date()): string {
  // ISO week: e.g. "2026-W26". Compute the Monday of the week.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfIsoWeek(d: Date): Date {
  const date = new Date(d);
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - dayNum);
  return date;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? "10") || 10));

  const consent = await db().consent.findFirst({
    where: { userId, kind: "leaderboards" },
  });
  const optedIn = consent ? consent.granted : true; // default opt-in per UI-UX.md §8

  const weekKey = isoWeekKey();
  const start = startOfIsoWeek(new Date());

  // Compute weekly XP per user from `XpEvent` rows this week.
  const events = await db().xpEvent.findMany({
    where: { createdAt: { gte: start } },
  });
  const perUser = new Map<string, number>();
  for (const e of events) {
    perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + e.amount);
  }

  const ranked = Array.from(perUser.entries())
    .map(([u, xp]) => ({ userId: u, weeklyXp: xp }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp);

  const myXp = perUser.get(userId) ?? 0;
  const myTier = tierForXp(myXp);
  const myRank = ranked.findIndex((r) => r.userId === userId) + 1;

  // Hydrate the top N with display names from `User`.
  const topIds = ranked.slice(0, limit).map((r) => r.userId);
  const users = await db().user.findMany({
    where: { id: { in: topIds } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = ranked.slice(0, limit).map((r, i) => {
    const u = userMap.get(r.userId);
    return {
      rank: i + 1,
      userId: r.userId,
      displayName: u?.displayName ?? "Anonymous reader",
      avatarUrl: u?.avatarUrl ?? null,
      weeklyXp: r.weeklyXp,
      isCurrentUser: r.userId === userId,
    };
  });

  log.info({
    event: "habit.leaderboard_view",
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    week: weekKey,
    private_mode: !optedIn,
  });

  return NextResponse.json({
    weekKey,
    leagueName: myTier.name,
    leagueTier: myTier.name.toLowerCase(),
    privateMode: !optedIn,
    todayKey: localDateKey(),
    currentUser: {
      weeklyXp: myXp,
      rank: myRank > 0 ? myRank : null,
    },
    rows,
  });
}
