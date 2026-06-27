import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Load the monorepo-root `.env` into process.env. Next.js only auto-loads
// `.env` from the app directory (`apps/web`), but our single source of truth
// lives at the repo root, so DB-touching routes 500 with "DATABASE_URL not
// found" without this. Existing process.env values win (e.g. Railway service
// env vars in prod), so this is a dev/local convenience only.
function loadRootEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || key in process.env) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // No root .env (e.g. CI/prod with real service env vars) — skip silently.
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  // Standalone output keeps the deploy bundle small and lets us run as a
  // single Node server in Railway. Per the v1 plan §"Hosting/data setup".
  output: "standalone",

  // Make pnpm workspace packages resolve to their TS sources in dev.
  transpilePackages: [
    "@readmaxxing/ui",
    "@readmaxxing/core",
    "@readmaxxing/tts",
    "@readmaxxing/db",
    "@readmaxxing/config",
    "@readmaxxing/ai",
  ],

  typedRoutes: true,

  // Performance budgets (UI-UX.md §10) — fail CI if exceeded.
  // Enforced via `pnpm size`; reader bundle ≤ 150KB gzip.
};

export default nextConfig;