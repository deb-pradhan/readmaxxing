import type { Config } from "tailwindcss";
import { font } from "./src/tokens";
import { elevation, radius } from "./src/tokens";

/**
 * Tailwind theme preset for ReadMaxxing — maps M-Chef + Visual Language v2
 * design tokens (DESIGN-SYSTEM.md §24.1, §25.10) into Tailwind's `theme.extend`.
 *
 * v2 changes:
 * - **Dropped hardcoded accent hex.** Every accent color reads
 *   `rgb(var(--coral-XXX) / <alpha-value>)` so themes (esp. e-ink) can
 *   remap via CSS vars and utilities like `bg-coral-500/40` compose alpha.
 * - **Added elevation scale** (`elev-1/2/3`) + `soft` legacy alias.
 * - **Added v2 radius scale** (`thumb/tile/sheet/squircle/circle`) and kept
 *   `sm/md/lg/xl/2xl/full` as legacy aliases for one release.
 * - **Added mono font** via `font.mono` token (Geist Mono).
 * - **Legacy aliases** (`bg-coral`, `bg-coral-bg`, `text-coral-text`,
 *   `shadow-soft`, `rounded-md`) continue to resolve via re-exports.
 */
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../apps/web/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "16px",
        md: "24px",
      },
    },
    extend: {
      colors: {
        // Surface + ink + border — driven by per-theme CSS vars.
        canvas: "var(--surface-canvas)",
        card: "var(--surface-card)",
        "card-muted": "var(--surface-muted)",
        elevated: "var(--surface-elevated)",
        inverse: "var(--surface-inverse)",
        overlay: "var(--surface-overlay)",

        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--text-secondary)",
          faint: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
          "inverse-muted": "var(--text-inverse-muted)",
        },

        // Coral primary ramp — channels consumed via rgb() so alpha works.
        // Themes (light/dark/sepia/eink) drive the channels via themeCssVars.
        coral: {
          50: "rgb(var(--coral-050) / <alpha-value>)",
          100: "rgb(var(--coral-100) / <alpha-value>)",
          500: "rgb(var(--coral-500) / <alpha-value>)",
          600: "rgb(var(--coral-600) / <alpha-value>)",
          700: "rgb(var(--coral-700) / <alpha-value>)",
          900: "rgb(var(--coral-900) / <alpha-value>)",
          soft: "rgb(var(--coral-soft) / <alpha-value>)",
          text: "rgb(var(--coral-text) / <alpha-value>)",
          // Legacy aliases — bg / fg / soft / text, kept for one release.
          bg: "var(--coral-bg)",
          fg: "var(--coral-fg)",
          "bg-soft": "var(--coral-bg-soft)",
        },

        // Editorial secondary accents (DESIGN-SYSTEM §25.1).
        butter: {
          bg: "var(--butter-bg)",
          soft: "var(--butter-soft)",
          text: "var(--butter-text)",
          fg: "var(--butter-fg)",
        },
        lavender: {
          bg: "var(--lavender-bg)",
          soft: "var(--lavender-soft)",
          text: "var(--lavender-text)",
          fg: "var(--lavender-fg)",
        },
        mint: {
          bg: "var(--mint-bg)",
          soft: "var(--mint-soft)",
          text: "var(--mint-text)",
          fg: "var(--mint-fg)",
        },
        // Lime — ≤1 per screen, tiles only.
        lime: {
          bg: "var(--lime-bg)",
          soft: "var(--lime-soft)",
          ink: "var(--lime-ink)",
        },

        // Legacy "accent" alias kept for backwards compat — maps to coral.
        accent: {
          DEFAULT: "var(--accent-bg)",
          soft: "var(--accent-soft)",
          text: "var(--accent-text)",
          focus: "var(--accent-focus)",
        },

        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          inverse: "var(--border-inverse)",
        },

        // Semantic state colors — kept as hex; they don't theme-remap.
        success: "#1F9E5A",
        "success-soft": "#E5F6EC",
        warning: "#C97A0F",
        "warning-soft": "#FFF1DC",
        danger: "#D62E2E",
        "danger-soft": "#FCE4E4",
        info: "#2A5BD7",
        "info-soft": "#E2EAFB",
      },
      fontFamily: {
        sans: font.sans.split(", "),
        mono: font.mono.split(", "),
      },
      fontSize: {
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
      },
      borderRadius: {
        // v2 shape language.
        thumb: radius.thumb,
        card: radius.card,
        tile: radius.tile,
        sheet: radius.sheet,
        squircle: radius.squircle,
        pill: radius.pill,
        circle: radius.circle,
        // Legacy aliases.
        xs: radius.xs,
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        "2xl": radius["2xl"],
        full: radius.full,
      },
      maxWidth: {
        reading: "66ch",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        base: "220ms",
        slow: "320ms",
        deliberate: "480ms",
        highlight: "120ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        in: "cubic-bezier(0.6, 0, 0.8, 0.2)",
        inout: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      boxShadow: {
        // v2 elevation scale.
        "elev-1": elevation["elev-1"],
        "elev-2": elevation["elev-2"],
        "elev-3": elevation["elev-3"],
        // Legacy aliases (some old call sites use `shadow-soft`).
        xs: "0 1px 2px rgba(14, 15, 18, 0.04)",
        sm: "0 2px 6px rgba(14, 15, 18, 0.06), 0 1px 2px rgba(14, 15, 18, 0.04)",
        md: "0 6px 16px rgba(14, 15, 18, 0.08), 0 2px 4px rgba(14, 15, 18, 0.04)",
        lg: "0 12px 32px rgba(14, 15, 18, 0.12), 0 4px 8px rgba(14, 15, 18, 0.06)",
        xl: "0 24px 56px rgba(14, 15, 18, 0.18), 0 8px 16px rgba(14, 15, 18, 0.08)",
        soft: elevation.soft,
        focus: "var(--focus-ring)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.2s linear infinite",
        fadeIn: "fadeIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;