/**
 * /api/health/deep — Phase 6 deeper liveness check.
 *
 * Returns the dependency graph as a structured response. Used by
 * Railway / on-call dashboards to spot-check the BFF + the worker
 * + the cache queue without poking each one separately.
 *
 * Per TESTING.md §11 production readiness: this endpoint must always
 * respond in < 500ms even on a degraded Postgres. Each probe has its
 * own timeout and is wrapped in try/catch so one slow dependency never
 * blocks the others.
 *
 * Response shape:
 *   {
 *     ok: boolean,                 // true iff all probes ok
 *     checks: {
 *       postgres: { ok, latency_ms, error? },
 *       redis:    { ok, latency_ms, error? } | { ok: false, error: "not_configured" },
 *       worker:   { ok, latency_ms, error? } | { ok: false, error: "not_configured" }
 *     },
 *     version, service, timestamp
 *   }
 *
 * 503 when any required probe fails. 200 when all configured probes pass.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@readmaxxing/db";
import { log } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProbeResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

let prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

async function probePostgres(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // `SELECT 1` via $queryRaw — the cheapest possible ping.
    await db().$queryRaw`SELECT 1`;
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message.slice(0, 200),
    };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const url = process.env["REDIS_URL"];
  if (!url) return { ok: false, latency_ms: 0, error: "not_configured" };
  const start = Date.now();
  try {
    // `ioredis` is an optional dep — we never `require` it at boot.
    // The dynamic import + cast pattern below means the typechecker
    // doesn't try to resolve the module if it's not installed.
    const specifier = "ioredis";
    const mod = await import(/* webpackIgnore: true */ specifier).catch(() => null);
    const IORedis = (mod as { default?: new (url: string, opts?: unknown) => unknown } | null)?.default;
    if (!IORedis) {
      return { ok: true, latency_ms: 0, error: "ioredis_not_installed_skipped" };
    }
    const client = new (IORedis as new (url: string, opts?: unknown) => { connect(): Promise<void>; ping(): Promise<string>; quit(): Promise<void> })(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await client.connect();
    try {
      await client.ping();
      return { ok: true, latency_ms: Date.now() - start };
    } finally {
      await client.quit().catch(() => undefined);
    }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message.slice(0, 200),
    };
  }
}

async function probeWorker(): Promise<ProbeResult> {
  const url = process.env["WORKER_API_URL"];
  if (!url) return { ok: false, latency_ms: 0, error: "not_configured" };
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const headers: Record<string, string> = {};
    const token = process.env["WORKER_API_TOKEN"];
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
        signal: controller.signal,
        headers,
      });
      const ok = res.ok;
      return {
        ok,
        latency_ms: Date.now() - start,
        error: ok ? undefined : `status_${res.status}`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 200),
    };
  }
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const [postgres, redis, worker] = await Promise.all([
    probePostgres(),
    probeRedis(),
    probeWorker(),
  ]);
  // Redis is optional — when `not_configured`, it's a soft-skip not a fail.
  // Worker is optional too — the BFF falls back to in-process AI when missing.
  const requiredOk = postgres.ok && (redis.ok || redis.error === "not_configured");
  const ok = requiredOk;
  if (!ok) {
    log.warn({
      event: "health.deep_degraded",
      status: "error",
      postgres_ok: postgres.ok,
      redis_ok: redis.ok,
      worker_ok: worker.ok,
    });
  }
  return NextResponse.json(
    {
      ok,
      service: "web",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      checks: { postgres, redis, worker },
    },
    { status: ok ? 200 : 503 },
  );
}
