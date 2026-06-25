/**
 * Font families per UI-UX.md §3.2:
 * - Long-form serif: Source Serif (book-like, immersion).
 * - UI sans: Inter (system fallback).
 * - Dyslexia option: Atkinson Hyperlegible (offer, never force).
 * - Mono for code blocks.
 *
 * Fonts are loaded via `next/font/google` in apps/web/app/layout.tsx
 * and exposed here as CSS `font-family` stacks that the web app can
 * wire to a `data-font` attribute on the root.
 */

export type FontFamily = "serif" | "sans" | "dyslexia" | "mono";

export const fontStacks: Record<FontFamily, string> = {
  serif: '"Source Serif 4", "Source Serif Pro", Charter, "Iowan Old Style", Georgia, serif',
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  dyslexia:
    '"Atkinson Hyperlegible", "Inter", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const defaultFontFor: Record<"reading" | "ui" | "code", FontFamily> = {
  reading: "serif",
  ui: "sans",
  code: "mono",
};

/** Tabular figures for any time/progress/count column. */
export const tabularFiguresStyle = {
  fontVariantNumeric: "tabular-nums" as const,
  fontFeatureSettings: '"tnum" 1' as const,
};