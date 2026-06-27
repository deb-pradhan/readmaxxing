import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Chrome extension popup smoke test.
 *
 * Only the Chromium project is enabled — Firefox and WebKit don't
 * support `--load-extension`. Run with `pnpm test:e2e` after a
 * `pnpm build` (the dist/ directory is what Playwright loads).
 */
export default defineConfig({
  testDir: "./test",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
