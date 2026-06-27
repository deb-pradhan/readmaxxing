/**
 * Structured logger for the BFF.
 *
 * Per TESTING.md §8.1 every log line emits:
 *   ts, level, service, request_id, user_id_hash, event, duration_ms?, status
 *
 * Privacy: no PII, no document text, no AI answers — counts and lengths only
 * (TESTING.md §8.7). The logger is a thin writer to `console`; in production
 * the platform's log drain (Railway) collects the JSON lines.
 */

import { createHash, randomUUID } from "node:crypto";

const SERVICE = "web";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  event?: string;
  request_id?: string;
  user_id_hash?: string;
  status?: "ok" | "error" | "fallback";
  duration_ms?: number;
  [k: string]: unknown;
}

function hashUserId(userId: string | null | undefined): string | undefined {
  if (!userId) return undefined;
  return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

function emit(level: LogLevel, fields: LogFields): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    ...fields,
  };
  const out = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const log = {
  debug(fields: LogFields): void {
    if (process.env["NODE_ENV"] === "production") return;
    emit("debug", fields);
  },
  info(fields: LogFields): void {
    emit("info", fields);
  },
  warn(fields: LogFields): void {
    emit("warn", fields);
  },
  error(fields: LogFields): void {
    emit("error", fields);
  },
};

/** Generate a UUIDv4 request id (Next 15 doesn't ship a global uuid helper). */
export function newRequestId(): string {
  return randomUUID();
}

/** Hash a user id for log output (TESTING.md §8.1 — never log raw Privy id). */
export function userIdHash(userId: string | null | undefined): string | undefined {
  return hashUserId(userId);
}

/**
 * Read `x-user-id` / `x-dev-user-id` from request headers and return either
 * a non-empty user id (string) or `null` for "not authed". The route handler
 * is responsible for mapping `null` to a 401.
 */
export function readUserId(headers: Headers): string | null {
  const fromHeader = headers.get("x-user-id") ?? headers.get("x-dev-user-id");
  if (!fromHeader) return null;
  const trimmed = fromHeader.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Time an async operation and emit a single log line. The `event` argument is
 * the result event (e.g. "ai.task_complete"); the `startEvent` is the
 * paired start event (e.g. "ai.task_start") that runs first.
 */
export async function timed<T>(args: {
  startEvent: string;
  endEvent: string;
  baseFields: LogFields;
  fn: () => Promise<T>;
}): Promise<T> {
  const start = Date.now();
  log.info({ ...args.baseFields, event: args.startEvent });
  try {
    const out = await args.fn();
    log.info({
      ...args.baseFields,
      event: args.endEvent,
      status: "ok",
      duration_ms: Date.now() - start,
    });
    return out;
  } catch (err) {
    log.error({
      ...args.baseFields,
      event: args.endEvent,
      status: "error",
      duration_ms: Date.now() - start,
      error_class: (err as Error).name,
      error_msg: (err as Error).message.slice(0, 200),
    });
    throw err;
  }
}
