/**
 * Design tokens — single source of truth for the visual language.
 *
 * Canonical design law: docs/UI-UX.md
 *
 * - Light surface: warm off-white paper `#FBFBF8`, never pure white.
 * - Dark surface: true-dark `#0E0E10`, never pure black.
 * - Max 3 functional colors on screen: text, surface, accent.
 * - Body 16–20px fluid, line-height 1.5–1.6, measure 66ch.
 * - Modular scale 1.250 (minor third).
 * - Tabular figures for any data column.
 * - Spacing scale on 4px grid.
 * - Motion 150–250ms ease-out entrances; respect prefers-reduced-motion.
 */

export const space = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "32px",
  8: "40px",
  9: "48px",
  10: "64px",
  11: "80px",
  12: "96px",
} as const;

export const radius = {
  xs: "6px",
  sm: "10px",
  md: "14px",
  lg: "20px",
  xl: "28px",
  full: "9999px",
} as const;

export const fontSize = {
  xs: ["11px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
  sm: ["13px", { lineHeight: "1.45" }],
  base: ["16px", { lineHeight: "1.55" }],
  md: ["18px", { lineHeight: "1.55" }],
  lg: ["22px", { lineHeight: "1.45" }],
  xl: ["28px", { lineHeight: "1.3" }],
  "2xl": ["36px", { lineHeight: "1.2" }],
  "3xl": ["48px", { lineHeight: "1.15" }],
  display: ["72px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
} as const;

export const lineHeight = {
  tight: "1.1",
  snug: "1.2",
  normal: "1.4",
  relaxed: "1.55",
  loose: "1.65",
} as const;

export const tracking = {
  tightest: "-0.04em",
  tight: "-0.02em",
  normal: "0",
  wide: "0.04em",
  widest: "0.12em",
} as const;

export const duration = {
  instant: "80ms",
  fast: "150ms",
  base: "220ms",
  slow: "320ms",
  highlight: "120ms", // word-advance; fast but not strobing (WCAG 2.3.1)
} as const;

export const easing = {
  out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  in: "cubic-bezier(0.6, 0, 0.8, 0.2)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const zIndex = {
  base: "0",
  raised: "10",
  sticky: "20",
  overlay: "50",
  modal: "100",
  toast: "200",
} as const;

/** Measure: 50–75 chars, target 66ch per UI-UX.md §3.2. */
export const measure = "66ch";

/** Fluid body type per UI-UX.md §3.2: clamp(16px, 1.1vw + 1rem, 20px). */
export const fluidBody = "clamp(16px, 1.1vw + 1rem, 20px)";

/** Functional palette per UI-UX.md §3.1. 3 colors max on screen: text, surface, accent. */
export const functional = {
  /** Single calm accent used only for the *active* state — current word, primary CTA. */
  accent: "#5B4DEF",
  /** Sentence-tint highlight (soft, ~12% opacity on the accent). */
  accentSoft: "rgba(91, 77, 239, 0.12)",
  /** Stronger word-fill highlight. */
  accentStrong: "rgba(91, 77, 239, 0.28)",
  /** Focus ring on interactive elements. */
  focus: "rgba(91, 77, 239, 0.45)",
} as const;