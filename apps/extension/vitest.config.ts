import { defineConfig } from "vitest/config";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@readmaxxing/ui": path.resolve(repoRoot, "packages/ui/src/index.ts"),
      "@readmaxxing/core": path.resolve(repoRoot, "packages/core/src/index.ts"),
      "@readmaxxing/tts": path.resolve(repoRoot, "packages/tts/src/index.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    pool: "threads",
  },
});
