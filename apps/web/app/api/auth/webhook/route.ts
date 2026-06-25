import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { verifyPrivyWebhook } from "@/lib/privy-verify";

/**
 * Privy webhook handler.
 *
 * On `user.created` (and `user.updated` / `user.linked_account` for
 * subsequent logins) we upsert a row in Postgres so the rest of the app
 * can FK to a real User.
 *
 * Privy calls this endpoint *without* a user session token — the request
 * is authenticated by an HMAC signature over the raw body. The
 * `/api/auth/webhook` path is whitelisted in middleware.ts.
 *
 * Privy event payload shape (relevant subset):
 *   {
 *     type: "user.created" | "user.updated" | "user.linked_account",
 *     data: {
 *       id: "did:privy:...",
 *       email?: { address: string },
 *       wallet?: { walletClientType, address, chainId },
 *       linkedAccounts?: [...],
 *       createdAt: number,
 *     }
 *   }
 */

export const runtime = "nodejs";

interface PrivyUserData {
  id: string;
  email?: { address: string };
  wallet?: { address: string };
  createdAt?: number;
}

interface PrivyEvent {
  type: "user.created" | "user.updated" | "user.linked_account" | string;
  data: PrivyUserData;
}

let prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("privy-signature");
  const rawBody = await request.text();

  const valid = await verifyPrivyWebhook(rawBody, signature);
  if (!valid) {
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 },
    );
  }

  let event: PrivyEvent;
  try {
    event = JSON.parse(rawBody) as PrivyEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    event.type !== "user.created" &&
    event.type !== "user.updated" &&
    event.type !== "user.linked_account"
  ) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const { id, email, wallet } = event.data;
  if (!id) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  try {
    const user = await getPrisma().user.upsert({
      where: { id },
      create: {
        id,
        email: email?.address ?? null,
        walletAddress: wallet?.address ?? null,
        displayName: email?.address?.split("@")[0] ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        email: email?.address ?? undefined,
        walletAddress: wallet?.address ?? undefined,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("privy webhook: upsert failed", err);
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  // Liveness check — handy for verifying the route is wired.
  return NextResponse.json({ ok: true, route: "auth/webhook" });
}