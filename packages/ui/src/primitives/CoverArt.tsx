"use client";

/**
 * CoverArt — deterministic gradient-mesh cover for documents.
 *
 * Per DESIGN-SYSTEM §25.6: every document gets a cover. We hash the
 * `seed` (a document id, title, or any stable string) into a small
 * palette + angle pair and render it as a pure CSS multi-stop
 * background. No AI image gen, no network, no per-document artwork
 * storage — same seed → same gradient, every render.
 *
 * Token-only: every color is read from a CSS variable, so themes
 * (light/dark/sepia/eink) remap the entire palette and the cover
 * still resolves. The fallback "accent" stops are the documented
 * editorial palette from §25.1 — coral, butter, lavender, mint, lime.
 */

import * as React from "react";
import { cn } from "../cn";

export type CoverArtAspect = "3/4" | "1/1" | "16/9";

export interface CoverArtProps {
  /** Stable string used to derive the gradient. Same seed → same cover. */
  seed: string;
  /** Optional title — rendered as a centered title overlay. */
  title?: string;
  /** Aspect ratio. Default "3/4" (vertical, like a book cover). */
  aspect?: CoverArtAspect;
  /** Optional extra class names. */
  className?: string;
  /**
   * Decorative by default — the parent (DocCard) already exposes the
   * title via a heading. Pass `decorative={false}` if you want the
   * cover to be announced to assistive tech.
   */
  decorative?: boolean;
  /** Accessible label when `decorative` is false. */
  "aria-label"?: string;
}

/** Editorial accents — indexable; mapped to CSS vars in `coverStops`. */
const ACCENTS = ["coral", "butter", "lavender", "mint", "lime"] as const;
type Accent = (typeof ACCENTS)[number];

/**
 * CSS-var-backed stops. Order matters — index N selects stop N.
 *
 * Every stop is a CSS variable reference — no hex literal ships in
 * the rendered output (the test enforces this). When the variable
 * is missing the stop resolves to `initial`, which still renders as
 * a flat color (the cover may lose its family tint, but the
 * deterministic gradient shape stays). Themes (esp. e-ink) remap
 * the variables to grayscale automatically.
 */
const COVER_STOPS: Readonly<Record<Accent, string>> = {
  coral: "var(--coral-500)",
  butter: "var(--butter)",
  lavender: "var(--lavender)",
  mint: "var(--mint)",
  lime: "var(--lime)",
};

/** Soft variants — used for the wash stop so the cover is never flat. */
const COVER_SOFT: Readonly<Record<Accent, string>> = {
  coral: "var(--coral-100)",
  butter: "var(--butter-soft)",
  lavender: "var(--lavender-soft)",
  mint: "var(--mint-soft)",
  lime: "var(--lime-soft)",
};

/**
 * Tiny string → 32-bit hash (FNV-1a, deterministic across engines).
 * Pure JS so it works in SSR + test environments without Web Crypto.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit.
  return hash >>> 0;
}

/** Map a hash to one of the editorial accents. */
function pickAccent(hash: number, salt: number): Accent {
  const idx = (hash ^ salt) % ACCENTS.length;
  return ACCENTS[Math.abs(idx)] ?? "coral";
}

/** Map a hash to a 0–359 degree angle. */
function pickAngle(hash: number, salt: number): number {
  return (Math.abs(hash ^ salt) % 360);
}

/** Aspect ratio → Tailwind aspect utility. */
const ASPECT_CLASS: Record<CoverArtAspect, string> = {
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
};

export const CoverArt = React.forwardRef<HTMLDivElement, CoverArtProps>(
  function CoverArt(
    {
      seed,
      title,
      aspect = "3/4",
      className,
      decorative = true,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    // Derive three accent picks (primary, secondary, wash) and two angles.
    // Salting the hash per slot keeps the three picks decorrelated.
    const h = React.useMemo(() => fnv1a(seed || "readmaxxing"), [seed]);
    const primary: Accent = React.useMemo(() => pickAccent(h, 0x1a), [h]);
    const secondary: Accent = React.useMemo(
      () => pickAccent(h, 0xb7),
      [h],
    );
    // Wash is always soft (low chroma) — picked from the same family as primary
    // for tonal harmony; falls back to a single accent if it collides.
    const wash: Accent = React.useMemo(() => primary, [primary]);
    const angle1 = React.useMemo(() => pickAngle(h, 0x55), [h]);
    const angle2 = React.useMemo(() => pickAngle(h, 0x9e), [h]);

    const primaryStop = COVER_STOPS[primary];
    const secondaryStop = COVER_STOPS[secondary];
    const washStop = COVER_SOFT[wash];

    // The background is composed of two stacked linear gradients plus
    // a radial wash on top. The wash is what creates the "mesh" feel —
    // it lifts one corner so the cover never reads as flat.
    const background = [
      `linear-gradient(${angle1}deg, ${primaryStop} 0%, ${primaryStop} 45%, ${secondaryStop} 100%)`,
      `linear-gradient(${angle2}deg, transparent 0%, transparent 55%, ${secondaryStop} 100%)`,
      `radial-gradient(circle at 75% 15%, ${washStop} 0%, transparent 55%)`,
    ].join(", ");

    return (
      <div
        ref={ref}
        role={decorative ? undefined : "img"}
        aria-hidden={decorative ? "true" : undefined}
        aria-label={decorative ? undefined : ariaLabel ?? "Cover"}
        data-cover-seed={seed}
        data-cover-primary={primary}
        data-cover-secondary={secondary}
        data-cover-aspect={aspect}
        className={cn(
          "relative w-full overflow-hidden rounded-card",
          ASPECT_CLASS[aspect],
          className,
        )}
        style={{ background }}
      >
        {title ? (
          <span
            aria-hidden={decorative ? undefined : "true"}
            className={cn(
              "absolute inset-0 flex items-end p-4",
              "text-left font-bold leading-tight text-white mix-blend-overlay",
              "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
            )}
          >
            <span className="line-clamp-3 text-sm sm:text-base">
              {title}
            </span>
          </span>
        ) : null}
      </div>
    );
  },
);