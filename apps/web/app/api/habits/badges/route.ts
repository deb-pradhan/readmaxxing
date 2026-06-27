/**
 * /api/habits/badges — Phase 5.5 milestone badge definitions + awards.
 *
 * - GET → returns the canonical badge definitions seeded by the
 *   `Badge` table (or the inline seed when the table is empty), and
 *   merges in the user's `UserBadge` rows.
 *
 * Per TESTING.md §2.14 #5: a user crossing a milestone inserts a
 * `UserBadge` row. The inline seed list lets the UI render the full
 * grid even before any `Badge` rows exist; real award logic lives in
 * `/api/habits/xp` for streak milestones + a follow-up helper for the
 * other criteria.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

interface BadgeSeed {
  id: string;
  name: string;
  description: string;
  requirement: string;
  tier: "bronze" | "silver" | "gold";
}

const BADGE_SEEDS: BadgeSeed[] = [
  {
    id: "two-week-warrior",
    name: "2-Week Warrior",
    description: "Read for 14 days in a row.",
    requirement: "Reach a 14-day streak.",
    tier: "gold",
  },
  {
    id: "century-reader",
    name: "Century Reader",
    description: "Read 100,000 words across all documents.",
    requirement: "Read 100,000 words.",
    tier: "bronze",
  },
  {
    id: "marathon-listener",
    name: "Marathon Listener",
    description: "Listen for 10+ hours at 2x or higher.",
    requirement: "10h at 2×+ playback.",
    tier: "silver",
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Maintain 3× playback across 5 docs.",
    requirement: "5 docs at 3×+.",
    tier: "silver",
  },
  {
    id: "quiz-master",
    name: "Quiz Master",
    description: "Score 100% on 10 quizzes.",
    requirement: "10 perfect quizzes.",
    tier: "gold",
  },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Try the canonical Badge table first; fall back to the seed.
  let definitions: BadgeSeed[] = BADGE_SEEDS;
  try {
    const rows = await db().badge.findMany();
    if (rows.length > 0) {
      definitions = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        requirement: r.description,
        tier: (r.tier as "bronze" | "silver" | "gold") ?? "bronze",
      }));
    }
  } catch {
    /* table may not exist yet — fall through to seed */
  }

  const earned = await db().userBadge.findMany({ where: { userId } });
  const earnedMap = new Map(earned.map((b) => [b.badgeId, b.awardedAt]));

  const badges = definitions.map((b) => {
    const at = earnedMap.get(b.id);
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      requirement: b.requirement,
      tier: b.tier,
      earnedAt: at ? at.toISOString() : undefined,
    };
  });

  log.info({
    event: "habit.badges_view",
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    total: badges.length,
    earned: earned.length,
  });

  return NextResponse.json({ badges });
}
