/**
 * Design tokens — single source of truth for the visual language.
 *
 * Canonical design law: docs/DESIGN-SYSTEM.md (M-Chef system + Visual Language v2 §25).
 *
 * - Surface tokens: warm off-white (#ECEFE6) on light, true-dark (#0E0F12)
 *   on dark — never pure white or pure black.
 * - Brand accents: coral (primary, 6-stop ramp), butter / lavender / mint
 *   (supporting tiles), lime (editorial accent — ≤1 per screen, tiles only).
 *   All accents ship as CSS vars so themes (esp. e-ink) can remap them.
 * - Type families: Inter (sans, the only display/UI family) and Geist Mono
 *   (mono, for numerals / timecodes / counts / micro-labels).
 * - 4px spacing grid, modular 1.250 type scale (minor third).
 * - Radius: `thumb 12 / card 20 / tile 24 / sheet 28 / squircle 22 / pill 9999`.
 * - Elevation: `elev-1 / elev-2 / elev-3` (soft aliases `elev-2`).
 * - Hairlines: `subtle` (8% ink), `strong` (16% ink).
 * - Motion: 80–480ms with explicit easings; respect prefers-reduced-motion.
 * - WCAG 2.2 AA: body 4.5:1, large text 3:1, UI components 3:1.
 */

/**
 * Font family stacks. The mono stack leads with Geist Mono (loaded via
 * `next/font/google` in `apps/web/app/layout.tsx`) and falls back to
 * JetBrains Mono, then `ui-monospace`. The sans stack keeps Inter.
 *
 * Exposed both as a `font` object (token layer) and via
 * `packages/ui/src/fonts.ts` (legacy consumers).
 */
export const font = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

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
  /** v2 shape language — see DESIGN-SYSTEM §25.3. */
  thumb: "12px",
  card: "20px",
  tile: "24px",
  sheet: "28px",
  squircle: "22px",
  pill: "9999px",
  circle: "50%",
  /** Legacy aliases — kept for one release to avoid breaking imports. */
  xs: "6px",
  sm: "10px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  "2xl": "36px",
  full: "9999px",
} as const;

/**
 * Elevation scale (DESIGN-SYSTEM §25.3).
 * Cards rest at `elev-1`, lift to `elev-2` on hover, sheets/menus use `elev-3`.
 * `soft` is a legacy alias for `elev-2` (fixes the prior `shadow-soft` no-op).
 */
export const elevation = {
  "elev-1": "0 1px 2px rgba(14,15,18,.05)",
  "elev-2": "0 6px 20px rgba(14,15,18,.08)",
  "elev-3": "0 16px 40px rgba(14,15,18,.12)",
  /** Legacy alias — `shadow-soft` referenced in 3 sites, was undefined. */
  soft: "0 6px 20px rgba(14,15,18,.08)",
} as const;

/**
 * Hairline borders (DESIGN-SYSTEM §25.1).
 * Structural rules and dividers — prefer a hairline over a boxed border.
 */
export const hairline = {
  subtle: "rgba(14,15,18,.08)",
  strong: "rgba(14,15,18,.16)",
} as const;

export const fontSize = {
  xs: ["11px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
  sm: ["13px", { lineHeight: "1.4" }],
  base: ["15px", { lineHeight: "1.5" }],
  md: ["17px", { lineHeight: "1.5" }],
  lg: ["20px", { lineHeight: "1.3" }],
  xl: ["28px", { lineHeight: "1.2" }],
  "2xl": ["36px", { lineHeight: "1.15" }],
  "3xl": ["48px", { lineHeight: "1.1" }],
  display: ["80px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
  mega: ["120px", { lineHeight: "1.0", letterSpacing: "-0.04em" }],
} as const;

export const lineHeight = {
  tight: "1.05",
  snug: "1.2",
  normal: "1.4",
  relaxed: "1.5",
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
  deliberate: "480ms",
  /** Word-advance; fast but not strobing (WCAG 2.3.1). */
  highlight: "120ms",
} as const;

export const easing = {
  out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  in: "cubic-bezier(0.6, 0, 0.8, 0.2)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const zIndex = {
  base: "0",
  raised: "10",
  sticky: "20",
  overlay: "50",
  modal: "100",
  toast: "200",
} as const;

/** Reading column measure — 66ch (DESIGN-SYSTEM §6.5). */
export const measure = "66ch";

/** Coral focus ring — 3px / 35% alpha halo (DESIGN-SYSTEM §19.2). */
export const focusRing = "0 0 0 3px rgba(255, 92, 68, 0.35)";

/**
 * @deprecated Prefer CSS variables (e.g. `var(--coral-500)`) or the
 * `themeCssVars` / `useThemeTokens` surface. This hex map is kept only
 * for inline SVG stroke consumers (StreakRing, XPBar) that haven't been
 * tokenized yet — will be removed in a follow-up.
 */
export const brand = {
  coralBg: "#FF5C44",
  coralSoft: "#FFE3DC",
  coralText: "#C8341B",
  butterBg: "#F5C84C",
  butterSoft: "#FFEFC5",
  butterText: "#6B4F00",
  lavenderBg: "#B5A6FF",
  lavenderSoft: "#E4DDFF",
  lavenderText: "#4433B5",
  mintBg: "#7FE3B0",
  mintSoft: "#D6F5E5",
  mintText: "#1B6B45",
  ink: "#0E0F12",
} as const;

export const semantic = {
  success: "#1F9E5A",
  successBg: "#E5F6EC",
  warning: "#C97A0F",
  warningBg: "#FFF1DC",
  danger: "#D62E2E",
  dangerBg: "#FCE4E4",
  info: "#2A5BD7",
  infoBg: "#E2EAFB",
} as const;