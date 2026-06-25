import type { NextConfig } from "next";

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

  experimental: {
    // Server actions are used in Phase 2+ for position writes.
    typedRoutes: true,
  },

  // Performance budgets (UI-UX.md §10) — fail CI if exceeded.
  // Enforced via `pnpm size` in Phase 2; reader bundle ≤ 150KB gzip.
};

export default nextConfig;