/**
 * Vitest config for the mobile app.
 *
 * The mobile source ships TypeScript + React Native primitives; vitest
 * runs in jsdom and we mock the native modules (`react-native`,
 * `expo-av`, `expo-secure-store`, `expo-linking`) at the test level
 * so we can exercise the auth shim + theme provider without a real
 * device.
 *
 * Heavy native deps (react-native, expo-*) aren't imported at the
 * top level — they're lazy-loaded inside the source so the unit
 * tests can run in pure Node.
 */

import { defineConfig } from "vitest/config";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@readmaxxing/ui": path.resolve(repoRoot, "packages/ui/src/index.ts"),
      "@readmaxxing/core": path.resolve(repoRoot, "packages/core/src/index.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    environment: "jsdom",
    globals: true,
    pool: "threads",
  },
});
