import { defineConfig } from "vitest/config";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@readmaxxing/ui": path.resolve(repoRoot, "packages/ui/src/index.ts"),
      "@readmaxxing/ui/primitives": path.resolve(repoRoot, "packages/ui/src/primitives/index.ts"),
      "@readmaxxing/core": path.resolve(repoRoot, "packages/core/src/index.ts"),
      "@readmaxxing/core/tts": path.resolve(repoRoot, "packages/core/src/tts/index.ts"),
      "@readmaxxing/core/sync": path.resolve(repoRoot, "packages/core/src/sync/index.ts"),
      "@readmaxxing/core/pipeline": path.resolve(repoRoot, "packages/core/src/pipeline/index.ts"),
      "@readmaxxing/tts": path.resolve(repoRoot, "packages/tts/src/index.ts"),
      "@readmaxxing/db": path.resolve(repoRoot, "packages/db/src/index.ts"),
      "@readmaxxing/config": path.resolve(repoRoot, "packages/config/src/index.ts"),
      "@readmaxxing/ai": path.resolve(repoRoot, "packages/ai/src/index.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    pool: "threads",
  },
});