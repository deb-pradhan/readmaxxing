/**
 * Font families per DESIGN-SYSTEM.md §4 + §25.2:
 * - **Inter** is the UI / display family — headings, body, marketing.
 *   Tabular figures for any column of numbers / time / currency.
 * - **Geist Mono** (v2 addition, §25.12) is reserved for instrument-grade
 *   numerals, timecodes, counts, and micro-labels. JetBrains Mono is
 *   the fallback so the mono voice degrades gracefully on systems that
 *   haven't loaded Geist Mono yet.
 *
 * Fonts are loaded via `next/font/google` in `apps/web/app/layout.tsx`
 * and exposed here as CSS `font-family` stacks the rest of the app can
 * wire to `data-font` or Tailwind utilities.
 *
 * No serifs. No dyslexia font toggle. The system is calm on purpose —
 * the reader surface stays calm because the typography is consistent,
 * not because we offer 17 choices.
 */

export type FontFamily = "sans" | "mono";

export const fontStacks: Record<FontFamily, string> = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const defaultFontFor: Record<"ui" | "code", FontFamily> = {
  ui: "sans",
  code: "mono",
};

/** Tabular figures for any time / progress / count column. */
export const tabularFiguresStyle = {
  fontVariantNumeric: "tabular-nums" as const,
  fontFeatureSettings: '"tnum" 1' as const,
};