/**
 * /api/ai/podcasts/[id]/transcript — full episode transcript with timestamps.
 *
 * The transcript shape is derived from the `PodcastEpisode.script` JSON
 * (Phase 4 schema: `[{ speaker, voiceId, text, index }]`). Each line is
 * enriched with an estimated `timeStart` (ms) computed from the line's
 * position in the script and the episode's `durationSeconds` so the UI
 * can render clickable timestamps that seek the audio.
 *
 * Privacy: the transcript body is NOT logged. Per TESTING.md §8.7 the
 * route only emits counts and durations.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { readUserId } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

interface ScriptLine {
  speaker?: string;
  voiceId?: string;
  text?: string;
  index?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const userId = readUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await db().podcastEpisode.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      title: true,
      script: true,
      durationSeconds: true,
      status: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.status !== "completed") {
    return NextResponse.json(
      { error: "not_ready", status: row.status },
      { status: 409 },
    );
  }

  const script = (row.script as unknown as ScriptLine[]) ?? [];
  const totalChars = script.reduce(
    (acc, line) => acc + (line.text?.length ?? 0),
    0,
  );

  // We don't have line-by-line timing (the worker keeps it on the file);
  // we estimate proportionally to the character count. This is good
  // enough for click-to-seek since the player reconciles to actual audio
  // time within ~120ms (UI-UX.md §3.4).
  const totalSeconds = row.durationSeconds ?? 0;
  const lines = script.map((line, idx) => {
    const charLen = line.text?.length ?? 0;
    const ratio = totalChars > 0 ? charLen / totalChars : 0;
    const nextIdx = idx + 1;
    const nextLine = script[nextIdx];
    const nextCharLen = nextLine?.text?.length ?? 0;
    const nextRatio = totalChars > 0 ? nextCharLen / totalChars : 0;
    return {
      index: idx,
      speaker: line.speaker ?? "H1",
      voiceId: line.voiceId ?? null,
      text: line.text ?? "",
      timeStart: ratio * totalSeconds,
      timeEnd: (1 - nextRatio) * totalSeconds,
    };
  });

  return NextResponse.json({
    id: row.id,
    title: row.title,
    durationSeconds: totalSeconds,
    lineCount: lines.length,
    lines,
  });
}