import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import manifest from "./manifest.json" with { type: "json" };

const repoRoot = resolve(__dirname, "../..");

/**
 * Vite config for the ReadMaxxing Chrome extension.
 *
 * - `crx()` wraps the build to produce a Chrome MV3 extension from the
 *   `manifest.json` at the project root. It emits `dist/manifest.json`,
 *   `dist/background.js`, `dist/content.js`, `dist/popup.html`, and
 *   the hashed JS/CSS bundles.
 * - Workspace packages (`@readmaxxing/core`, `@readmaxxing/ui`) are
 *   resolved from the repo root via path aliases so we share the same
 *   source the web app uses — UI-UX.md §11 consistency rule.
 * - `preserveSymlinks: false` keeps the bundle paths stable for the
 *   `chrome.runtime.getURL('assets/...')` lookups in the overlay.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@readmaxxing/ui": resolve(repoRoot, "packages/ui/src/index.ts"),
      "@readmaxxing/core": resolve(repoRoot, "packages/core/src/index.ts"),
      "@readmaxxing/tts": resolve(repoRoot, "packages/tts/src/index.ts"),
    },
    preserveSymlinks: false,
  },
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        // Split heavy vendor chunks so the popup + overlay + content
        // scripts each get a small initial bundle. The content script
        // is the most size-sensitive — see TESTING.md §2.15.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "vendor-react";
            if (id.includes("@mozilla/readability")) return "vendor-readability";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
