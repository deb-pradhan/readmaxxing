/**
 * /api/user/preferences — Phase 5.5 settings persistence.
 *
 * - GET  → returns the user's full preference envelope (or the default
 *   shape when no row exists yet).
 * - PUT  → upserts a partial preference object. We do a shallow merge
 *   so the client can update one section at a time.
 *
 * Privacy: never log raw values from the prefs JSON — we log only the
 * keys that changed (TESTING.md §8.7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@readmaxxing/db";
import { log, newRequestId, readUserId, userIdHash } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export const DEFAULT_PREFS = {
  // Account
  displayName: null as string | null,
  // Voice — real ElevenLabs premade voice id (Alice, British RP). A
  // placeholder slug here would make first synthesis 502 with `voice_not_found`.
  defaultVoiceId: "Xb7hH8MSUJpSbSDYk0k2",
  // Theme
  theme: "light" as "light" | "dark" | "sepia" | "eink" | "system",
  // Typography
  font: "serif" as "serif" | "sans" | "dyslexia" | "mono",
  fontSize: 18,
  lineSpacing: 1.6,
  measure: 66,
  bionic: false,
  bionicFixation: 0.4,
  bionicOpacity: 0.85,
  // Reading
  defaultSpeed: 1,
  defaultGoalMetric: "minutes" as "minutes" | "words" | "articles",
  defaultGoalValue: 15,
  focusModeDefault: false,
  skipFillerDefault: false,
  // Habit
  reminderTime: null as string | null,
  leaderboardOptIn: true,
  freezesAvailable: 1,
  language: "en",
  // Privacy
  cacheLocalIndexedDb: true,
  downloadedAudioKept: true,
  // Accessibility
  reducedMotion: false,
  highContrast: false,
  dyslexiaShortcut: "Alt+D",
};

const PutBody = z
  .object({
    displayName: z.string().max(80).nullable().optional(),
    defaultVoiceId: z.string().max(200).optional(),
    theme: z.enum(["light", "dark", "sepia", "eink", "system"]).optional(),
    font: z.enum(["serif", "sans", "dyslexia", "mono"]).optional(),
    fontSize: z.number().min(14).max(24).optional(),
    lineSpacing: z.number().min(1.3).max(1.8).optional(),
    measure: z.number().min(60).max(80).optional(),
    bionic: z.boolean().optional(),
    bionicFixation: z.number().min(0.1).max(0.7).optional(),
    bionicOpacity: z.number().min(0.1).max(1).optional(),
    defaultSpeed: z.number().min(0.5).max(4.5).optional(),
    defaultGoalMetric: z.enum(["minutes", "words", "articles"]).optional(),
    defaultGoalValue: z.number().int().min(1).max(1000).optional(),
    focusModeDefault: z.boolean().optional(),
    skipFillerDefault: z.boolean().optional(),
    reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    leaderboardOptIn: z.boolean().optional(),
    freezesAvailable: z.number().int().min(0).max(10).optional(),
    language: z.string().min(2).max(8).optional(),
    cacheLocalIndexedDb: z.boolean().optional(),
    downloadedAudioKept: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    highContrast: z.boolean().optional(),
    dyslexiaShortcut: z.string().max(20).optional(),
  })
  .partial();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await db().userPreference.findUnique({ where: { userId } });
  const stored = (row?.prefs ?? {}) as Partial<typeof DEFAULT_PREFS>;
  return NextResponse.json({ ...DEFAULT_PREFS, ...stored });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId();
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof PutBody>;
  try {
    body = PutBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", message: (err as Error).message },
      { status: 400 },
    );
  }

  const existing = await db().userPreference.findUnique({ where: { userId } });
  const next = { ...((existing?.prefs ?? {}) as object), ...body };

  await db().userPreference.upsert({
    where: { userId },
    create: { userId, prefs: next as unknown as object },
    update: { prefs: next as unknown as object },
  });

  log.info({
    event: "user.preferences_updated",
    request_id: requestId,
    user_id_hash: userIdHash(userId),
    keys: Object.keys(body),
  });

  return NextResponse.json({ ...DEFAULT_PREFS, ...next });
}
