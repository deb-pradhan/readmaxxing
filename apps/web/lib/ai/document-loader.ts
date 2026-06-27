/**
 * Document loader for the AI BFF.
 *
 * Phase 3 needs a small "load this document's text + its last position" helper
 * that the four AI routes share. The Prisma client is the same one used by
 * the import + positions routes.
 */

import { PrismaClient } from "@readmaxxing/db";
import type { SegmentTree } from "@readmaxxing/core";

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export interface LoadedDocument {
  id: string;
  userId: string;
  title: string;
  tree: SegmentTree;
  text: string;
  wordCount: number;
}

/** Load a document owned by `userId` (404 if not found). Returns the plain text too. */
export async function loadDocument(
  documentId: string,
  userId: string,
): Promise<LoadedDocument | null> {
  const doc = await db().document.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      userId: true,
      title: true,
      wordCount: true,
      segmentTree: true,
    },
  });
  if (!doc) return null;
  const tree = doc.segmentTree as unknown as SegmentTree;
  return {
    id: doc.id,
    userId: doc.userId,
    title: doc.title,
    tree,
    text: tree?.text ?? "",
    wordCount: doc.wordCount,
  };
}

/** Load the user's most recent PlaybackPosition for a document. */
export async function loadLastPosition(
  userId: string,
  documentId: string,
): Promise<{ wordOffset: number; updatedAt: Date } | null> {
  const row = await db().playbackPosition.findUnique({
    where: { userId_documentId: { userId, documentId } },
    select: { wordOffset: true, updatedAt: true },
  });
  return row;
}

/** Resolve the paragraph + sentence anchor for a given word offset. */
export function anchorForWord(
  tree: SegmentTree,
  wordOffset: number,
): { paragraphIndex: number; sentenceIndex: number } {
  let remaining = Math.max(0, wordOffset);
  for (let p = 0; p < tree.paragraphs.length; p++) {
    const para = tree.paragraphs[p]!;
    for (let s = 0; s < para.sentences.length; s++) {
      const sent = para.sentences[s]!;
      if (remaining < sent.words.length) {
        return { paragraphIndex: p, sentenceIndex: s };
      }
      remaining -= sent.words.length;
    }
  }
  // Past the end — return the last sentence.
  const lastPara = tree.paragraphs[tree.paragraphs.length - 1];
  const lastSent = lastPara?.sentences[lastPara.sentences.length - 1];
  if (!lastSent) return { paragraphIndex: 0, sentenceIndex: 0 };
  return {
    paragraphIndex: tree.paragraphs.length - 1,
    sentenceIndex: lastPara!.sentences.length - 1,
  };
}

/** Record an AI usage row for billing/quota. Best-effort — never blocks. */
export async function recordUsage(args: {
  userId: string;
  action: "ai_summary" | "ai_quiz" | "ai_ask" | "ai_recap" | "filler_detect";
  quantity: number;
  provider?: string;
  sourceId?: string;
  costCents?: number;
}): Promise<void> {
  try {
    await db().usageLedger.create({
      data: {
        userId: args.userId,
        metric: args.action,
        amount: args.quantity,
        provider: args.provider ?? "openrouter",
        sourceId: args.sourceId ?? null,
        costCents: args.costCents ?? 0,
      },
    });
  } catch (err) {
    // Don't fail the response on metering — just log.
    console.error("recordUsage failed", (err as Error).message);
  }
}
