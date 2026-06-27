/**
 * Centralized environment-variable validation.
 *
 * The web app and the worker both import from `@readmaxxing/config/env` so
 * missing/typo'd env vars fail loudly at boot instead of at request time.
 *
 * Two schemas:
 *   - `clientEnvSchema` — values safe to ship to the browser (NEXT_PUBLIC_*)
 *   - `serverEnvSchema` — server-only secrets
 *
 * Each environment exposes a parsed, frozen `clientEnv` / `serverEnv` object
 * via `loadEnv()`.
 */

import { z } from "zod";

const nonEmptyString = (label: string) =>
  z.string().min(1, `${label} is required`);

const clientSchema = z.object({
  NEXT_PUBLIC_PRIVY_APP_ID: nonEmptyString("NEXT_PUBLIC_PRIVY_APP_ID"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  // Observability — DSN is public-safe (Sentry scope is the project, not a secret).
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: nonEmptyString("DATABASE_URL"),
  REDIS_URL: z.string().url().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  PRIVY_WEBHOOK_SECRET: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  // Primary LLM gateway — one key, any model (OpenAI, Anthropic, Google, Meta…).
  OPENROUTER_API_KEY: z.string().optional(),
  // Optional direct-access overrides (skip OpenRouter if you want).
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  WORKER_API_URL: z.string().url().optional(),
  WORKER_API_TOKEN: z.string().optional(),
  // Observability (server-only — server DSNs and log destinations).
  SENTRY_DSN: z.string().url().optional(),
  LOG_DESTINATION: z
    .enum(["stdout", "axiom", "logtail"])
    .default("stdout"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Parse `process.env` (or a partial env object for testing) against the
 * client schema. Throws ZodError on validation failure.
 */
export function parseClientEnv(env: Record<string, unknown>): ClientEnv {
  return clientSchema.parse(env);
}

/**
 * Parse `process.env` (or a partial env object for testing) against the
 * server schema. Throws ZodError on validation failure.
 */
export function parseServerEnv(env: Record<string, unknown>): ServerEnv {
  return serverSchema.parse(env);
}

/**
 * Convenience accessor: parses `process.env` for the requested scope.
 *
 * In the web app, call `loadEnv("client")` in client components and
 * `loadEnv("server")` in server components / route handlers.
 */
export function loadEnv(scope: "client"): ClientEnv;
export function loadEnv(scope: "server"): ServerEnv;
export function loadEnv(scope: "client" | "server"): ClientEnv | ServerEnv {
  // In Node 20+, `process.env` is the only env source we read.
  const source = (process.env as Record<string, unknown>) ?? {};
  return scope === "client" ? parseClientEnv(source) : parseServerEnv(source);
}