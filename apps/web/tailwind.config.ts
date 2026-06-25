import type { Config } from "tailwindcss";
import baseConfig from "@readmaxxing/ui/tailwind.config";

/**
 * Web app tailwind config — inherits the ReadMaxxing token system from
 * `@readmaxxing/ui/tailwind.config` and overrides `content` to include
 * the web app's own files.
 */
const config: Config = {
  ...baseConfig,
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;