/**
 * Theme presets — light / dark / sepia / eink.
 *
 * Per DESIGN-SYSTEM.md §3.1 + §24.1:
 * - Light surface: warm off-white `#ECEFE6`, never pure white.
 * - Dark surface: true-dark `#0E0F12`, never `#000`.
 * - Sepia: warm cream long-form reading surface.
 * - E-ink: low-stimulation grayscale for long reading sessions
 *   (no accents, full surface palette only — calms the eye when
 *   reading for hours).
 *
 * Contrast: WCAG 2.2 AA body (4.5:1), AAA on the reading surface (7:1).
 * Coral focus ring is constant across all themes (DESIGN-SYSTEM §19.2).
 */

export type ThemeName = "light" | "dark" | "sepia" | "eink";

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
}

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
    textTertiary: "#8E929B",
    textInverse: "#F4F1EA",
    textInverseMuted: "#B5B8BF",

    borderSubtle: "rgba(14, 15, 18, 0.06)",
    borderDefault: "rgba(14, 15, 18, 0.10)",
    borderStrong: "rgba(14, 15, 18, 0.18)",
    borderInverse: "rgba(255, 255, 255, 0.10)",

    hoverTint: "rgba(14, 15, 18, 0.04)",
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
    textTertiary: "#7A7E87",
    textInverse: "#0E0F12",
    textInverseMuted: "#5C6068",

    borderSubtle: "rgba(255, 255, 255, 0.06)",
    borderDefault: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    borderInverse: "rgba(14, 15, 18, 0.10)",

    hoverTint: "rgba(255, 255, 255, 0.05)",
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
    textTertiary: "#9A8866",
    textInverse: "#F4ECD8",
    textInverseMuted: "#B8A57E",

    borderSubtle: "rgba(59, 46, 26, 0.08)",
    borderDefault: "rgba(59, 46, 26, 0.16)",
    borderStrong: "rgba(59, 46, 26, 0.28)",
    borderInverse: "rgba(244, 236, 216, 0.10)",

    hoverTint: "rgba(59, 46, 26, 0.05)",
  },
  // E-ink — pure grayscale, low stimulation. No accents.
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
    textTertiary: "#6A6A6A",
    textInverse: "#FFFFFF",
    textInverseMuted: "#B5B5B5",

    borderSubtle: "rgba(0, 0, 0, 0.12)",
    borderDefault: "rgba(0, 0, 0, 0.24)",
    borderStrong: "rgba(0, 0, 0, 0.40)",
    borderInverse: "rgba(255, 255, 255, 0.10)",

    hoverTint: "rgba(0, 0, 0, 0.06)",
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
 */
export function themeCssVars(theme: ThemeTokens): Record<string, string> {
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
  };
}