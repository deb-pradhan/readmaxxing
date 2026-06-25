/**
 * Theme presets — Light (warm paper), Dark (true dark), Sepia, E-ink.
 *
 * Per UI-UX.md §3.1:
 * - Light surface: warm off-white `#FBFBF8`, not pure white.
 * - Dark surface: true-dark `#0E0E10`, not `#000`.
 * - Text on dark: low-glare `#E6E6E0`.
 * - Sepia / E-ink for long-form / evening.
 * - Contrast: WCAG 2.2 AA body (4.5:1), AAA on the reading surface (7:1).
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

  /** Hairline border on cards. */
  borderSubtle: string;
  /** Default border on inputs / dividers. */
  borderDefault: string;
  /** Emphasized border. */
  borderStrong: string;

  /** Hover tint background (for ghost buttons / rows). */
  hoverTint: string;
}

export const themes: Record<ThemeName, ThemeTokens> = {
  light: {
    surfaceCanvas: "#FBFBF8",
    surfaceCard: "#FFFFFF",
    surfaceMuted: "#F4F1E9",
    surfaceElevated: "#FFFFFF",
    surfaceInverse: "#0E0E10",
    surfaceOverlay: "rgba(14, 14, 16, 0.55)",

    textPrimary: "#1A1A1F",
    textSecondary: "#5A5A63",
    textTertiary: "#8A8A92",
    textInverse: "#E6E6E0",

    borderSubtle: "rgba(14, 14, 16, 0.06)",
    borderDefault: "rgba(14, 14, 16, 0.12)",
    borderStrong: "rgba(14, 14, 16, 0.22)",

    hoverTint: "rgba(14, 14, 16, 0.04)",
  },
  dark: {
    surfaceCanvas: "#0E0E10",
    surfaceCard: "#161618",
    surfaceMuted: "#1E1E22",
    surfaceElevated: "#22222A",
    surfaceInverse: "#FBFBF8",
    surfaceOverlay: "rgba(0, 0, 0, 0.65)",

    textPrimary: "#E6E6E0",
    textSecondary: "#A8A8B0",
    textTertiary: "#6F6F78",
    textInverse: "#1A1A1F",

    borderSubtle: "rgba(255, 255, 255, 0.06)",
    borderDefault: "rgba(255, 255, 255, 0.12)",
    borderStrong: "rgba(255, 255, 255, 0.22)",

    hoverTint: "rgba(255, 255, 255, 0.05)",
  },
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

    borderSubtle: "rgba(59, 46, 26, 0.08)",
    borderDefault: "rgba(59, 46, 26, 0.16)",
    borderStrong: "rgba(59, 46, 26, 0.28)",

    hoverTint: "rgba(59, 46, 26, 0.05)",
  },
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

    borderSubtle: "rgba(0, 0, 0, 0.12)",
    borderDefault: "rgba(0, 0, 0, 0.24)",
    borderStrong: "rgba(0, 0, 0, 0.40)",

    hoverTint: "rgba(0, 0, 0, 0.06)",
  },
};

/**
 * Serialize theme tokens as CSS custom properties on `[data-theme=...]`.
 * This keeps the design system portable across React/web/extension without
 * needing a build-time CSS-in-JS dependency.
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

    "--border-subtle": theme.borderSubtle,
    "--border-default": theme.borderDefault,
    "--border-strong": theme.borderStrong,

    "--hover-tint": theme.hoverTint,
  };
}