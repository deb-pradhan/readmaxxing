/**
 * /api/habits/quests — Phase 5.5 weekly quests.
 *
 * - GET → returns the current week's active quests + the user's
 *   `QuestCompletion` rows. Progress is derived from `XpEvent.amount`
 *   for the current ISO week, bucketed per quest kind.
 *
 * The quest seed list is a constant for v1 — production would let
 * admins edit them via the studio. The contract here is what the
 * BFF returns; the `Quest` table is the canonical store but we
 * keep the seed in code so the BFF can answer before any rows are
 * inserted (Phase 5.5 follow-up: cron + admin UI).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";
import { localDateKey, mondayOf } from "@/lib/habits/date-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

interface QuestSeed {
  id: string;
  name: string;
  description: string;
  target: number;
  xpReward: number;
  /** Which XpEvent source counts toward progress. */
  source: "listening" | "quiz" | "podcast" | "reading" | "ocr" | "voice_typing";
}

const QUEST_SEEDS: QuestSeed[] = [
  {
    id: "weekly-listen-3",
    name: "Listen to 3 docs",
    description: "Finish 3 documents this week.",
    target: 3,
    xpReward: 25,
    source: "listening",
  },
  {
    id: "weekly-quiz-2",
    name: "Take 2 quizzes",
    description: "Test yourself twice — recall is the whole point.",
    target: 2,
    xpReward: 20,
    source: "quiz",
  },
  {
    id: "weekly-podcast-1",
    name: "Finish 1 podcast",
    description: "Generate and finish one AI podcast episode.",
    target: 1,
    xpReward: 30,
    source: "podcast",
  },
  {
    id: "weekly-voice-typing",
    name: "Dictate for 5 minutes",
    description: "Use voice typing for at least 5 minutes this week.",
    target: 5,
    xpReward: 15,
    source: "voice_typing",
  },
];

const PostBody = z.object({
  questId: z.string().min(1),
});

function startOfIsoWeek(d: Date): Date {
  const date = new Date(d);
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - dayNum);
  return date;
}

function progressForSource(
  events: { source: string; amount: number; sourceId: string | null }[],
  source: QuestSeed["source"],
): number {
  // For "listening" / "voice_typing" we tally XP; for the others we
  // tally distinct `sourceId` values (one per completed action).
  if (source === "listening" || source === "voice_typing") {
    return events
      .filter((e) => e.source === source)
      .reduce((sum, e) => sum + e.amount, 0);
  }
  const seen = new Set<string>();
  for (const e of events) {
    if (e.source === source && e.sourceId) seen.add(e.sourceId);
  }
  return seen.size;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = localDateKey();
  const start = startOfIsoWeek(new Date());
  const events = await db().xpEvent.findMany({
    where: { userId, createdAt: { gte: start } },
    select: { source: true, amount: true, sourceId: true },
  });
  const completions = await db().questCompletion.findMany({
    where: { userId, questId: { in: QUEST_SEEDS.map((q) => q.id) } },
  });
  const completedMap = new Map(completions.map((c) => [c.questId, c]));

  const quests = QUEST_SEEDS.map((seed) => {
    const progress = progressForSource(events, seed.source);
    const completed = completedMap.get(seed.id);
    return {
      id: seed.id,
      name: seed.name,
      description: seed.description,
      target: seed.target,
      progress: Math.min(progress, seed.target),
      xpReward: seed.xpReward,
      completedAt: completed?.completedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    weekStart: mondayOf(today),
    todayKey: today,
    quests,
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

  const seed = QUEST_SEEDS.find((q) => q.id === body.questId);
  if (!seed) {
    return NextResponse.json({ error: "quest_not_found" }, { status: 404 });
  }

  // Idempotent — `QuestCompletion` has `@@unique([userId, questId])`.
  const created = await db().questCompletion.upsert({
    where: { userId_questId: { userId, questId: body.questId } },
    create: { userId, questId: body.questId },
    update: {},
  });

  // Award the bonus XP via the same path the XP route uses.
  try {
    await db().xpEvent.create({
      data: {
        userId,
        amount: seed.xpReward,
        source: "milestone_bonus",
        sourceId: body.questId,
      },
    });
  } catch {
    /* meter is best-effort */
  }

  log.info({
    event: "habit.quest_completed",
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    quest_id: body.questId,
    xp_reward: seed.xpReward,
  });

  return NextResponse.json(
    {
      questId: body.questId,
      completedAt: created.completedAt.toISOString(),
      xpAwarded: seed.xpReward,
    },
    { status: 200 },
  );
}
