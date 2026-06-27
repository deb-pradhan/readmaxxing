/**
 * Font families per DESIGN-SYSTEM.md §4:
 * - Inter is the only family — UI, headings, body, marketing display.
 *   Tabular figures for any column of numbers / time / currency.
 * - JetBrains Mono is reserved for code-like strings (IDs, JSON,
 *   technical logs).
 *
 * Fonts are loaded via `next/font/google` in `apps/web/app/layout.tsx`
 * and exposed here as CSS `font-family` stacks the rest of the app can
 * wire to `data-font` or Tailwind utilities.
 *
 * No serifs. No dyslexia font toggle. The system is single-family on
 * purpose — the reader surface stays calm because the typography is
 * consistent, not because we offer 17 choices.
 */

export type FontFamily = "sans" | "mono";

export const fontStacks: Record<FontFamily, string> = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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