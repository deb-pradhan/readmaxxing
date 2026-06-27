/**
 * Theme presets — light / dark / sepia / eink.
 *
 * Per DESIGN-SYSTEM.md §25.1 + §25.12:
 * - **Light** is default; warm off-white canvas (#ECEFE6), white cards.
 * - **Dark** is true-dark (#0E0F12), not OLED black.
 * - **Sepia** is a warm cream long-form reading surface.
 * - **E-ink** is grayscale-only, low stimulation for long reading sessions.
 *   Per §25.1: accents collapse to grayscale equivalents so the accent
 *   CSS vars still resolve and components don't fall back to undefined.
 *   The one non-gray element permitted is none.
 *
 * Contrast: WCAG 2.2 AA body (4.5:1), AAA on the reading surface (7:1).
 * Coral focus ring is constant across all themes (DESIGN-SYSTEM §19.2)
 * except e-ink, which uses a solid ink ring for forced-colors safety.
 *
 * Coral ramp (DESIGN-SYSTEM §25.1):
 *   coral-500 #FF5C44 — big/full-bleed fills (≥24px text only)
 *   coral-600 #D83A22 — primary CTA fill (white text 4.62:1, AA-safe)
 *   coral-700 #B82E18 — coral text/links on warm surfaces (5.2:1)
 *   coral-100 #FFE3DC — soft fill (active/selected row bg)
 */

export type ThemeName = "light" | "dark" | "sepia" | "eink";

export interface AccentRamp {
  /** Coral primary ramp — 050/100/500/600/700/900 + soft/text aliases. */
  coral: {
    "050": string;
    "100": string;
    "500": string;
    "600": string;
    "700": string;
    "900": string;
    soft: string;
    text: string;
  };
  /** Secondary editorial accents — used on tiles, never as primary CTA. */
  butter: { bg: string; soft: string; text: string };
  lavender: { bg: string; soft: string; text: string };
  mint: { bg: string; soft: string; text: string };
  /** Editorial accent — ≤1 per screen, tiles only (DESIGN-SYSTEM §25.1). */
  lime: { bg: string; soft: string; ink: string };
}

export interface ThemeTokens {
  /** App canvas background. */
  surfaceCanvas: string;
  /** Card / sheet background. */
  surfaceCard: string;
  /** Muted card / chip background. */
  surfaceMuted: string;
  /** Elevated surface (popovers, menus). */
  surfaceElevated: string;
  /** Inverse panel (AI-insight-style dark card on light theme). */
  surfaceInverse: string;
  /** Modal scrim. */
  surfaceOverlay: string;

  /** Primary body text. */
  textPrimary: string;
  /** Secondary text (metadata, timestamps). */
  textSecondary: string;
  /** Tertiary text (helper, placeholders). */
  textTertiary: string;
  /** Inverse text (used on dark sections). */
  textInverse: string;
  /** Inverse-muted text. */
  textInverseMuted: string;

  /** Hairline border on cards. */
  borderSubtle: string;
  /** Default border on inputs / dividers. */
  borderDefault: string;
  /** Emphasized border. */
  borderStrong: string;
  /** Border used on dark surfaces. */
  borderInverse: string;

  /** Hover tint background (for ghost buttons / rows). */
  hoverTint: string;

  /** Primary ink — used by `var(--ink)`. */
  ink: string;

  /** Per-theme focus ring (coral halo on light/dark/sepia, ink ring on e-ink). */
  focusRing: string;

  /** Accent ramp — see AccentRamp. */
  accents: AccentRamp;
}

// Light: warm off-white canvas, white cards, full coral ramp.
// Per §25.1, dark themes must lighten text-coral so coral text reads on dark.
const lightAccents: AccentRamp = {
  coral: {
    "050": "#FFF1ED",
    "100": "#FFE3DC",
    "500": "#FF5C44",
    "600": "#D83A22",
    "700": "#B82E18",
    "900": "#4A1B0C",
    soft: "#FFE3DC",
    text: "#B82E18",
  },
  butter: { bg: "#F5C84C", soft: "#FFEFC5", text: "#6B4F00" },
  lavender: { bg: "#B5A6FF", soft: "#E4DDFF", text: "#4433B5" },
  mint: { bg: "#7FE3B0", soft: "#D6F5E5", text: "#1B6B45" },
  lime: { bg: "#C7F03F", soft: "#EAF7B0", ink: "#34400A" },
};

// Dark: coral stays but text-coral lightens to ~#FF8A75 (AA on dark).
const darkAccents: AccentRamp = {
  coral: {
    "050": "#2A1410",
    "100": "#4A1B0C",
    "500": "#FF5C44",
    "600": "#FF6A52",
    "700": "#FF8A75",
    "900": "#FFD0C4",
    soft: "#3A1812",
    text: "#FF8A75",
  },
  butter: { bg: "#F5C84C", soft: "#3A2C0A", text: "#FFE49A" },
  lavender: { bg: "#B5A6FF", soft: "#241D52", text: "#C9BEFF" },
  mint: { bg: "#7FE3B0", soft: "#0F3A22", text: "#A6EBC8" },
  lime: { bg: "#C7F03F", soft: "#2A3408", ink: "#DCF78A" },
};

// Sepia: warm cream long-form reading surface. Coral stays; text-coral
// shifts slightly darker for legibility on cream.
const sepiaAccents: AccentRamp = {
  coral: {
    "050": "#FCEDE3",
    "100": "#F5D9C9",
    "500": "#D8553E",
    "600": "#B83E27",
    "700": "#8E2E1B",
    "900": "#3A140A",
    soft: "#F5D9C9",
    text: "#8E2E1B",
  },
  butter: { bg: "#E9B73A", soft: "#F4E2A8", text: "#5C4400" },
  lavender: { bg: "#A492E8", soft: "#D8CFEF", text: "#332680" },
  mint: { bg: "#7FE3B0", soft: "#C8E9D6", text: "#1B6B45" },
  lime: { bg: "#B6DC32", soft: "#DFEEA0", ink: "#2A3308" },
};

// E-ink: every accent collapses to grayscale equivalents of the same
// perceptual lightness so accent CSS vars still resolve but render as
// neutral. Coral-600 (#D83A22) → #1A1A1A per §25.1; soft tints go to
// pale gray (#E6E6E6); text on coral goes to near-black.
const einkAccents: AccentRamp = {
  coral: {
    "050": "#F2F2F2",
    "100": "#E6E6E6",
    "500": "#6A6A6A",
    "600": "#1A1A1A",
    "700": "#0A0A0A",
    "900": "#000000",
    soft: "#E6E6E6",
    text: "#1A1A1A",
  },
  butter: { bg: "#8E8E8E", soft: "#E0E0E0", text: "#1A1A1A" },
  lavender: { bg: "#9A9A9A", soft: "#E2E2E2", text: "#1A1A1A" },
  mint: { bg: "#7A7A7A", soft: "#DEDEDE", text: "#1A1A1A" },
  lime: { bg: "#5A5A5A", soft: "#D8D8D8", ink: "#1A1A1A" },
};

export const themes: Record<ThemeName, ThemeTokens> = {
  // Light — the default. Warm off-white canvas, white cards.
  light: {
    surfaceCanvas: "#ECEFE6",
    surfaceCard: "#FFFFFF",
    surfaceMuted: "#F4F1EA",
    surfaceElevated: "#FFFFFF",
    surfaceInverse: "#0E0F12",
    surfaceOverlay: "rgba(14, 15, 18, 0.55)",

    textPrimary: "#0E0F12",
    textSecondary: "#5C6068",
    textTertiary: "#646871", // §25.1 AA-safe tertiary (was #8E929B)
    textInverse: "#F4F1EA",
    textInverseMuted: "#B5B8BF",

    borderSubtle: "rgba(14, 15, 18, 0.06)",
    borderDefault: "rgba(14, 15, 18, 0.10)",
    borderStrong: "rgba(14, 15, 18, 0.18)",
    borderInverse: "rgba(255, 255, 255, 0.10)",

    hoverTint: "rgba(14, 15, 18, 0.04)",

    ink: "#0E0F12",
    focusRing: "0 0 0 3px rgba(255, 92, 68, 0.35)",

    accents: lightAccents,
  },
  // Dark — true dark, not OLED black. Low-glare text.
  dark: {
    surfaceCanvas: "#0E0F12",
    surfaceCard: "#18191C",
    surfaceMuted: "#222428",
    surfaceElevated: "#25272B",
    surfaceInverse: "#F4F1EA",
    surfaceOverlay: "rgba(0, 0, 0, 0.65)",

    textPrimary: "#F4F1EA",
    textSecondary: "#B5B8BF",
    textTertiary: "#8A8E96",
    textInverse: "#0E0F12",
    textInverseMuted: "#5C6068",

    borderSubtle: "rgba(255, 255, 255, 0.06)",
    borderDefault: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    borderInverse: "rgba(14, 15, 18, 0.10)",

    hoverTint: "rgba(255, 255, 255, 0.05)",

    ink: "#F4F1EA",
    focusRing: "0 0 0 3px rgba(255, 138, 117, 0.45)",

    accents: darkAccents,
  },
  // Sepia — warm cream long-form reading surface.
  sepia: {
    surfaceCanvas: "#F4ECD8",
    surfaceCard: "#FAF3E2",
    surfaceMuted: "#EADFC4",
    surfaceElevated: "#FAF3E2",
    surfaceInverse: "#3B2E1A",
    surfaceOverlay: "rgba(59, 46, 26, 0.55)",

    textPrimary: "#3B2E1A",
    textSecondary: "#6B5A40",
    textTertiary: "#75643F", // §25.1 AA-safe on sepia
    textInverse: "#F4ECD8",
    textInverseMuted: "#B8A57E",

    borderSubtle: "rgba(59, 46, 26, 0.08)",
    borderDefault: "rgba(59, 46, 26, 0.16)",
    borderStrong: "rgba(59, 46, 26, 0.28)",
    borderInverse: "rgba(244, 236, 216, 0.10)",

    hoverTint: "rgba(59, 46, 26, 0.05)",

    ink: "#3B2E1A",
    focusRing: "0 0 0 3px rgba(216, 85, 62, 0.40)",

    accents: sepiaAccents,
  },
  // E-ink — pure grayscale, low stimulation. No accents (grayscale remap).
  // Canvas is paper-white; cards are pure white with darker hairlines.
  eink: {
    surfaceCanvas: "#F2F2F2",
    surfaceCard: "#FFFFFF",
    surfaceMuted: "#E6E6E6",
    surfaceElevated: "#FFFFFF",
    surfaceInverse: "#000000",
    surfaceOverlay: "rgba(0, 0, 0, 0.5)",

    textPrimary: "#000000",
    textSecondary: "#3A3A3A",
    textTertiary: "#5A5A5A",
    textInverse: "#FFFFFF",
    textInverseMuted: "#B5B5B5",

    borderSubtle: "rgba(0, 0, 0, 0.12)",
    borderDefault: "rgba(0, 0, 0, 0.24)",
    borderStrong: "rgba(0, 0, 0, 0.40)",
    borderInverse: "rgba(255, 255, 255, 0.10)",

    hoverTint: "rgba(0, 0, 0, 0.06)",

    ink: "#000000",
    // Solid ink ring on e-ink — coral is forbidden; forced-colors safe.
    focusRing: "0 0 0 3px rgba(0, 0, 0, 0.60)",

    accents: einkAccents,
  },
};

/**
 * Resolve the initial theme name from a server-side cookie value.
 * Lives in this pure (non-"use client") module so `app/layout.tsx` can
 * call it during SSR to set `[data-theme]` and the matching CSS
 * variables before hydration.
 */
export function initialThemeFromCookie(cookie: string | undefined): ThemeName {
  if (!cookie) return "light";
  return (cookie in themes ? cookie : "light") as ThemeName;
}

/**
 * Serialize theme tokens as CSS custom properties on `[data-theme=...]`.
 * Kept in this pure module so it can run during SSR.
 *
 * v2 adds the full accent ramp (coral 050/100/500/600/700/900 + soft/text,
 * butter/lavender/mint, lime, ink, focusRing) so consumers can read
 * `var(--coral-600)` etc. and themes (esp. e-ink) can remap them.
 *
 * Accent values ship as **raw RGB channel triplets** (`255 92 68`) so
 * Tailwind utilities can compose alpha (`rgb(var(--coral-500) / 0.4)`).
 * Globals.css also wraps with `rgb(...)` where it needs the resolved
 * color. The legacy hex-named alias (`--coral-500-hex`) is provided for
 * any direct-fill consumer that needs the literal `#RRGGBB`.
 */
function hexToChannels(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0 0 0";
  const v = m[1]!;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function themeCssVars(theme: ThemeTokens): Record<string, string> {
  const a = theme.accents;
  const c050ch = hexToChannels(a.coral["050"]);
  const c100ch = hexToChannels(a.coral["100"]);
  const c500ch = hexToChannels(a.coral["500"]);
  const c600ch = hexToChannels(a.coral["600"]);
  const c700ch = hexToChannels(a.coral["700"]);
  const c900ch = hexToChannels(a.coral["900"]);
  const cSoftCh = hexToChannels(a.coral.soft);
  const cTextCh = hexToChannels(a.coral.text);

  return {
    "--surface-canvas": theme.surfaceCanvas,
    "--surface-card": theme.surfaceCard,
    "--surface-muted": theme.surfaceMuted,
    "--surface-elevated": theme.surfaceElevated,
    "--surface-inverse": theme.surfaceInverse,
    "--surface-overlay": theme.surfaceOverlay,

    "--text-primary": theme.textPrimary,
    "--text-secondary": theme.textSecondary,
    "--text-tertiary": theme.textTertiary,
    "--text-inverse": theme.textInverse,
    "--text-inverse-muted": theme.textInverseMuted,

    "--border-subtle": theme.borderSubtle,
    "--border-default": theme.borderDefault,
    "--border-strong": theme.borderStrong,
    "--border-inverse": theme.borderInverse,

    "--hover-tint": theme.hoverTint,

    "--ink": theme.ink,
    "--focus-ring": theme.focusRing,

    // Coral primary ramp — channels (for Tailwind alpha) + hex alias.
    "--coral-050": c050ch,
    "--coral-100": c100ch,
    "--coral-500": c500ch,
    "--coral-600": c600ch,
    "--coral-700": c700ch,
    "--coral-900": c900ch,
    "--coral-soft": cSoftCh,
    "--coral-text": cTextCh,
    "--coral-050-hex": a.coral["050"],
    "--coral-100-hex": a.coral["100"],
    "--coral-500-hex": a.coral["500"],
    "--coral-600-hex": a.coral["600"],
    "--coral-700-hex": a.coral["700"],
    "--coral-900-hex": a.coral["900"],
    "--coral-soft-hex": a.coral.soft,
    "--coral-text-hex": a.coral.text,
    // Legacy aliases (bg / fg) so old call sites keep working for one release.
    "--coral-bg": a.coral["500"],
    "--coral-fg": "#FFFFFF",
    "--coral-bg-soft": a.coral.soft,

    // Secondary editorial accents (DESIGN-SYSTEM §25.1).
    "--butter-bg": a.butter.bg,
    "--butter-soft": a.butter.soft,
    "--butter-text": a.butter.text,
    "--butter-fg": "#0E0F12",

    "--lavender-bg": a.lavender.bg,
    "--lavender-soft": a.lavender.soft,
    "--lavender-text": a.lavender.text,
    "--lavender-fg": "#FFFFFF",

    "--mint-bg": a.mint.bg,
    "--mint-soft": a.mint.soft,
    "--mint-text": a.mint.text,
    "--mint-fg": "#0E0F12",

    // Editorial lime accent — ≤1 per screen, tiles only.
    "--lime-bg": a.lime.bg,
    "--lime-soft": a.lime.soft,
    "--lime-ink": a.lime.ink,

    // Legacy accents (alias to coral so old utility classes keep working).
    "--accent-bg": a.coral["500"],
    "--accent-soft": a.coral.soft,
    "--accent-text": a.coral.text,
    "--accent-focus": "rgba(255, 92, 68, 0.35)",

    // Legacy ink alias.
    "--ink-bg": theme.ink,
    "--ink-fg": theme.surfaceCard,
  };
}