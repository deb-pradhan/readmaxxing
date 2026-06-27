# Design Spec — Visual Language v2 + UI-UX Audit Remediation

**Date:** 2026-06-27
**Status:** Draft (awaiting user review)
**Decision refs:** D39 (Visual Language v2), D12 (AI citations), D15 (latency honesty), D31 (no red in habit layer), D32/D33 (importer open by default)
**Plan ref:** Supersedes nothing; coexists with `docs/CHANGELOG.md`, `docs/DESIGN-SYSTEM.md`, `docs/UI-UX-AUDIT.md`.
**Owner:** ReadMaxxing engineering.

---

## 1. Purpose

Land the §25 Visual Language v2 across the entire web surface and remediate every P0 (critical) and P1 (high) finding from `docs/UI-UX-AUDIT.md`. After this lands, the app should feel like the reference palette / shape language rather than "impressive demo, not ships" (audit verdict), without breaking the universal `SegmentTree` model, the citation contract, the SSG cookie-based theme system, or any cross-surface test.

Two intent sources, one design:

- **`docs/DESIGN-SYSTEM.md` §25** defines Visual Language v2 — token names, type scale, components, motion, "Appendix B" rules.
- **`docs/UI-UX-AUDIT.md`** defines what is wrong with the current implementation and how to fix each finding.

The spec harmonizes both. Where the audit and §25 disagree on a value, §25 wins (it is the canonical design law). Where §25 is silent on a fix, the audit's recommendation is the source of truth.

---

## 2. Goals & non-goals

### 2.1 Goals

1. **Token fidelity.** Every color, radius, elevation, motion, and font token flows from one source. No hardcoded hex in components or SVGs.
2. **Accent remap.** E-ink theme truly drops every accent to grayscale. Coral is a 6-stop ramp (`050/100/500/600/700/900`) so hover/active/soft variants all derive from one palette.
3. **Reader honesty & a11y.** Reader fights the audit: every word is no longer a button, the active-word swap is color/bg only, the measure and leading fit a 45–70ch / 1.5–1.6 line, speed is re-applied on change, Media Session is wired, Coachmarks mount, tool buttons are ≥44px and recede.
4. **AI honesty.** `ChatBubble` tokenizes `[cite:p:s]` into CitationPills. The `/api/ai/ask` route returns a precomputed `prose` field so the client never sees raw markup. Error responses are human-readable; no "Request failed (500)".
5. **Importer trust.** `ImportResponse.id` → `documentId`; paste/text/URL imports no longer throw at the finish line (audit C1). ContinueShelf sits above the importer.
6. **Design language sweep.** Every page header uses Eyebrow micro-label + Display-1 + Subtitle. Counts are mono with superscripts. PlayerBar shows real voice names, mono timecodes, and a real status pill (no fake "come back later").
7. **Motion discipline.** All JS-driven motion (karaoke rAF, StreakRing rAF, smooth scroll, hairlines) honors `prefers-reduced-motion`. `forced-colors`, `prefers-contrast`, `prefers-reduced-transparency` media blocks are present.
8. **Component consolidation.** Three parallel player implementations collapse to one (`PlayerBar`). `Card` primitive is adopted. Dead components (`packages/ui/src/primitives/Player.tsx`) are deleted.
9. **Verify gate is green.** `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build` passes with no skipped/loosened tests.

### 2.2 Non-goals

- Tailwind v4 upgrade (D7 / gotcha #3 — stays v3.4.x).
- Mobile (Expo) and Chrome extension visual restyling. They will consume the same `packages/ui` tokens once this lands; restyling is a separate milestone.
- Adding new features (e.g., multiplayer, billing, social). Spec is remediation + design-system migration only.
- Server-side TTS audio persistence (gotcha #7 — unchanged).
- New auth surface or refactor of the OpenRouter gateway.
- Schema migrations beyond what already exists for `User` / `Document` / `Position`.

---

## 3. Architecture

### 3.1 Token layer (the single source of truth)

**`packages/ui/src/tokens.ts`** — extend, do not fork. Add:

```ts
export const font = {
  sans: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  mono: '"Geist Mono","JetBrains Mono",ui-monospace,monospace',
} as const;

export const radius = {
  thumb: "12px",
  card: "20px",
  tile: "24px",
  sheet: "28px",
  squircle: "22px",
  pill: "9999px",
  circle: "50%",
  // Keep legacy aliases for one release to avoid breaking imports.
  sm: "10px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  "2xl": "36px",
  full: "9999px",
} as const;

export const elevation = {
  "elev-1": "0 1px 2px rgba(14,15,18,.04), 0 1px 1px rgba(14,15,18,.04)",
  "elev-2": "0 4px 12px rgba(14,15,18,.06), 0 1px 3px rgba(14,15,18,.04)",
  "elev-3": "0 16px 32px rgba(14,15,18,.10), 0 4px 12px rgba(14,15,18,.06)",
  // Legacy alias (audit: `shadow-soft` undefined in 3 sites).
  soft: "0 4px 12px rgba(14,15,18,.06), 0 1px 3px rgba(14,15,18,.04)",
} as const;

export const hairline = {
  subtle: "rgba(14,15,18,.08)",
  strong: "rgba(14,15,18,.16)",
} as const;
```

**`packages/ui/src/themes.ts`** — widen `ThemeTokens` to carry accent + elevation + mono. The `themeCssVars` function now emits every accent (coral ramp, butter, lavender, mint, lime, ink) as CSS variables, and **the e-ink theme maps every accent to its grayscale equivalent** so coral-500 → neutral mid-gray, etc. The interface widens as follows (additive — existing fields unchanged):

```ts
export interface ThemeTokens {
  // …existing surface/text/border/hover fields…

  /** Coral primary ramp — 050/100/500/600/700/900 + soft/text aliases. */
  coral: { "050": string; "100": string; "500": string; "600": string; "700": string; "900": string; soft: string; text: string };
  butter: { bg: string; soft: string; text: string };
  lavender: { bg: string; soft: string; text: string };
  mint: { bg: string; soft: string; text: string };
  /** Editorial accent — ≤1 per screen, tiles only (DESIGN-SYSTEM §25.1). */
  lime: { bg: string; soft: string; ink: string };
  ink: string;
  focusRing: string;
}
```

E-ink values map every coral/butter/lavender/mint/lime to grayscale equivalents of the same lightness so the accent CSS vars still resolve and components don't fall back to undefined. `initialThemeFromCookie` stays in this pure module (gotcha #4).

**`packages/ui/tailwind.config.ts`** — drop the hardcoded hex map. Every accent color reads `rgb(var(--coral-500) / <alpha-value>)`. Add `boxShadow.elev-1/2/3`, `boxShadow.soft`, `boxShadow.focus`, `borderRadius.thumb/tile/sheet/squircle`, `fontFamily.mono`. The legacy `bg-coral`, `bg-coral-bg`, `text-coral-text`, `rounded-md`, `shadow-soft` aliases continue to resolve via re-exports for one release, then are removed in a follow-up.

**`packages/ui/src/globals.css`** — install the full §24.1 token block under `:root` (light defaults), and override per `[data-theme="..."]`. Delete the `:focus-visible { border-radius: var(--radius-sm, 10px); }` line (audit). Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { animation-duration: 80ms !important; transition-duration: 80ms !important; }
}
@media (forced-colors: active) { /* keep hairlines + focus ring */ }
@media (prefers-contrast: more) { /* bump border-default → border-strong */ }
@media (prefers-reduced-transparency: reduce) { /* drop overlay alpha to 0.95 */ }
```

**`packages/ui/src/fonts.ts`** — add `--font-mono` with `Geist Mono` first, fall back to `JetBrains Mono`, then `ui-monospace`, then `monospace`. Load Geist Mono in `apps/web/app/layout.tsx` via `next/font/google`.

### 3.2 Primitive layer

| Primitive | Change | Audit/§25 ref |
|---|---|---|
| **Icon.tsx** *(new)* | Lucide wrapper. `size: 16 \| 20 \| 24`, `strokeWidth: 1.5 \| 2`, accessible name pass-through, className merge. | D39 + §25.5 |
| **IconButton.tsx** *(new)* | Circular (`r-circle`), heights 36/44/52, three intents (primary/secondary/ghost). Replaces chrome icon buttons. | §25.5 |
| **Button.tsx** | Rebuild: `rounded-full` pill; heights 36/44/52; `variant="primary"` uses `--coral-600` (AA-passing); hover derived from token via `color-mix(in srgb, var(--coral-600) 92%, black)` (no hex); add `Button.Icon` slot; keep `<Button variant="primary" size="md">` API stable. | §25.5, audit coral CTA contrast |
| **KaraokeHighlighter.tsx** | Plain `<span>` per word; **single delegated click handler** on the container (uses `data-global-index`); active word swap is **color/bg only** (no `font-semibold`); honor `prefers-reduced-motion` on the rAF loop. | Audit C3, §25.6, §25.9 |
| **StreakRing.tsx**, **XPBar.tsx** | SVG stroke reads `var(--coral-500)` / `var(--mint-bg)` via `useThemeTokens()`. No hex. | §25.1 |
| **ReaderColumn.tsx** | Single sentence-scroller; smooth-scroll gated on `prefers-reduced-motion`. | Audit dual scroller |
| **DropdownMenu.tsx** | `role="menu"` with proper roving tabindex + arrow-key navigation + Escape. | Audit dropdown keys |
| **Dialog.tsx** | Already correct (native `<dialog>`); reused by `CommandPalette`, `KeyboardShortcuts`, new `ConfirmDialog`. | Audit modal focus |
| **Eyebrow.tsx** *(new primitive)* | UPPERCASE +0.08em, 11–12px, weight 600. Used in every page header. | §25.2 |
| **CountPill.tsx** *(new primitive)* | Mono numeral + 0.55em superscript badge. Used on filter chips, leaderboard rows, hero numbers. | §25.8 |
| **StatusPill.tsx** *(new primitive)* | Mono, deterministic, never lies. `Status: ready \| queued \| rendering \| error`. | D15, audit |
| **CitationPill.tsx** *(new primitive)* | Tokenizes `[cite:p:s]` into `↗¶N` pills; opens the matching paragraph. | D12, audit C4 |
| **Card.tsx** | Adopted everywhere. Default 20px radius, hairline border, optional `as` prop. | §25.6, audit |
| **Player.tsx** *(delete)* | Dead/orphan; `PlayerBar` becomes canonical chrome player; reader delegates. | Audit |

### 3.3 Surface sweep

Every page header gets `Eyebrow → Display-1 H1 → Subtitle`:

- `apps/web/app/(app)/library/page.tsx` — ContinueShelf moves above the importer (audit + D32). Fix `sourceType="pasted"` vs label mismatch (audit). DocCard uses real Chip + real Cover (deterministic gradient mesh, no AI image gen) + real Button.
- `apps/web/app/(app)/voice/page.tsx` — VoiceCloneFlow uses `coral-soft` (not the non-existent `coral-bg-soft` class).
- `apps/web/app/(app)/podcasts/page.tsx` + `[episodeId]/page.tsx` — replace raw enum status with `StatusPill`; honest copy "We'll email you when it's ready" (D15).
- `apps/web/app/(app)/assistant/page.tsx` — remove fake "Hi, Hanna!" hero. Real first-run empty state.
- `apps/web/app/(app)/dictation/page.tsx` — header sweep; mono timecodes.
- `apps/web/app/(app)/settings/page.tsx` — every `alert()` becomes `ConfirmDialog` (no mid-flow interruption).
- `apps/web/app/reader/[docId]/page.tsx` — header sweep; tool buttons ≥44px and recede when idle; mount `Coachmarks`; wire `media-session.ts`; `playbackRate` re-applied on speed change (audit C2); single sentence scroller; reading measure `min(70ch, 100%)` at 18px / 1.5 line.
- `apps/web/components/assistant/VoiceInput.tsx` — map `SpeechRecognitionErrorEvent.error` codes to human strings (`"We can't access your microphone. Check your browser permissions."`).

### 3.4 API route changes

| Route | Change |
|---|---|
| `apps/web/app/api/import/route.ts` | `ImportResponse` field is `documentId` (rename from `id`); update 4 read sites + router + test mock. |
| `apps/web/app/api/ai/ask/route.ts` | Response gains `prose` (already-cited plain text); existing `citations` array unchanged. |
| All `apps/web/app/api/*/route.ts` | Error envelope: `{ code: "HUMAN_LINE", hint?: string }`. No raw `Request failed (500)`, no raw HTTP codes. |
| `apps/web/app/api/user/preferences/route.ts` | Accept + persist `readingSpeed` and `theme` (theme already exists). |

---

## 4. Data flow

- **Theme.** Cookie-driven SSR sets `[data-theme]`; `themeCssVars` emits every accent; CSS vars drive Tailwind. No new client state. Gotcha #4 holds.
- **Reading speed.** `useEffect` on mount reads `user/preferences.readingSpeed`, sets `audioRef.playbackRate`. On change, both apply immediately and persist via PATCH `/api/user/preferences`.
- **Media Session.** `packages/core/src/player/media-session.ts` is instantiated in the reader page; subscribes to the existing `positionState` stream and `audioRef` events. No new state path.
- **Citations.** `validateCitations` already runs server-side in `packages/ai/src/index.ts` (D12). The new `prose` field is the rendered string with `[cite:p:s]` placeholders already inserted; the client `ChatBubble` tokenizes them into `CitationPill` rows that anchor-scroll to the matching paragraph in the loaded `SegmentTree`.
- **Importer.** `ImportResponse.documentId` flows into `router.push(`/reader/${documentId}`)`. No schema change.

---

## 5. Error handling

Four shapes, no exceptions:

1. **Inline field error** — form validation. Sentence case, ends with `.`, no implied user fault.
2. **Toast** — transient, recoverable. 4s auto-dismiss, action affordance for real retries.
3. **Empty state** — cold start or not-found. Friendly, action-led CTA.
4. **Status pill** — long-running (podcast render, OCR). Mono, deterministic, never lies about timing.

No `alert()`. No raw status codes. No `Request failed (500)`. Modals (CommandPalette, KeyboardShortcuts, ConfirmDialog) inherit `Dialog`'s focus trap, focus restore, Escape.

---

## 6. Testing

**Verify gate** (must pass before any "done" claim, per `CLAUDE.md`):

```bash
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build
```

"Tests pass" means tests unchanged or strengthened. No deletions, no loosenings.

### 6.1 New / extended tests

- `packages/ui/src/themes.test.ts` *(new)* — assert `themeCssVars('eink')` emits no coral/lime hex literals; assert coral-500/600/700 all present for light/dark/sepia.
- `packages/ui/src/primitives/Button.test.tsx` *(new)* — variant → computed coral-600 on primary; hover uses token-derived shade (no hardcoded hex).
- `packages/ui/src/primitives/KaraokeHighlighter.test.tsx` *(new)* — assert no `role="button"` on word spans; assert exactly one click handler on the container; assert active-word swap is color/bg only (no `font-weight` change).
- `packages/ui/src/primitives/cross-surface.test.tsx` *(extended)* — Button pill shape + Icon/IconButton render; mono token presence on timecode primitive; e-ink accent grayscale.
- `apps/web/app/api/import/route.test.ts` — assert response shape uses `documentId`; assert paste/text/URL all return 201 with a valid `documentId`.
- `apps/web/app/api/ai/ask/route.test.ts` — assert `prose` field present and `citations` array valid; assert error envelope uses human codes.
- `apps/web/app/(app)/library/page.test.tsx` *(new)* — ContinueShelf renders above ImportDropzone; "Pasted" filter is non-empty when seeded; DocCard uses `<Button>` (not raw coral).
- `apps/web/app/(app)/reader/[docId]/page.test.tsx` *(new)* — `playbackRate` re-applied on speed change; Coachmarks mounted; Media Session metadata set on `loadedmetadata`; reading measure at 45–70ch; line-height at 1.5–1.6.
- `apps/web/app/(app)/settings/page.test.tsx` *(new)* — no `alert()` calls; `<ConfirmDialog>` mounts for Log out / Export.
- `apps/web/components/assistant/VoiceInput.test.tsx` *(new)* — `SpeechRecognitionErrorEvent.error` codes mapped to human strings.
- `apps/web/components/ai/AskChat.test.tsx` *(new)* — `[cite:p:s]` markup tokenized into `<CitationPill>`; pill click anchors to paragraph.

### 6.2 Visual regression

Lightweight Playwright screenshot pass (manual, before/after) for: library page, reader page (idle + karaoke playing), voice page, podcasts page, settings page, assistant page. Snapshots stored under `apps/web/.visual-snapshots/`. Not gated by CI in this milestone.

---

## 7. Sequencing & milestones

Six phases, each with its own verify gate.

### Phase A — Foundation (V0)

**Scope:** Tokens, themes CSS vars, fonts (Geist Mono), tailwind remap, globals.css, e-ink grayscale, elevation scale.

**Files:** `packages/ui/src/tokens.ts`, `packages/ui/src/themes.ts`, `packages/ui/tailwind.config.ts`, `packages/ui/src/globals.css`, `packages/ui/src/fonts.ts`, `apps/web/app/layout.tsx`.

**Verify:** typecheck + lint + test + build.

### Phase B — Primitives

**Scope:** Button rebuild, Icon/IconButton, Eyebrow/CountPill/StatusPill/CitationPill, Dialog focus-trap refactor, DropdownMenu keys, StreakRing/XPBar tokenization, KaraokeHighlighter refactor, ReaderColumn single-scroller, Card adoption sweep, dead Player.tsx removal.

**Files:** all of `packages/ui/src/primitives/`; new `Icon.tsx` / `IconButton.tsx` / `Eyebrow.tsx` / `CountPill.tsx` / `StatusPill.tsx` / `CitationPill.tsx`; `apps/web/components/shared/ThemeSwitcher.tsx`, `AppHeader.tsx`.

**Verify:** typecheck + lint + test + build.

### Phase C — P0 ship-blockers

**Scope:** Audit C1–C4.

- C1 — ImportDropzone `documentId` rename, 4 read sites + test mock.
- C2 — `useEffect(() => audioRef.playbackRate = speed, [speed])`.
- C3 — Plain spans + delegated click in `KaraokeHighlighter`.
- C4 — `/api/ai/ask` returns `prose`; `ChatBubble` tokenizes cite markup into `CitationPill`.

**Files:** `apps/web/components/library/ImportDropzone.tsx`, `apps/web/app/reader/[docId]/page.tsx`, `apps/web/app/api/ai/ask/route.ts`, `apps/web/components/ai/AskChat.tsx`, `packages/ai/src/index.ts`, `apps/web/components/ai/ChatBubble.tsx`.

**Verify:** typecheck + lint + test + build.

### Phase D — P1 high

**Scope:** Media Session wire, speed persist, ContinueShelf reorder, "Pasted" filter fix, Coachmarks mount, modal focus trap + skip link, `:focus-visible` radius removal, DropdownMenu arrow keys, contrast pass (`--ink-3` + `--coral-600`), reader measure/leading fix, dual-scroller collapse, sub-44px targets (chips, toasts, coachmarks, voice picker) raised to ≥44px.

**Files:** `apps/web/app/reader/[docId]/page.tsx`, `apps/web/app/(app)/library/page.tsx`, `apps/web/app/(app)/settings/page.tsx`, `packages/core/src/player/media-session.ts`, `apps/web/app/layout.tsx`, `packages/ui/src/globals.css`, `packages/ui/src/themes.ts`, `packages/ui/src/primitives/{Chip,Toast,DropdownMenu,ReaderColumn,KaraokeHighlighter}.tsx`, `apps/web/components/voice/VoiceCloneFlow.tsx`.

**Verify:** typecheck + lint + test + build.

### Phase E — P2 sweep (medium)

**Scope:** Honesty copy (kill "Hi, Hanna!", kill raw voice IDs in `PlayerBar`, kill raw enum status in podcasts, kill every `alert()`), `shadow-soft` token, reduced-motion JS guards (StreakRing rAF, ReaderColumn smooth scroll), `coral-bg-soft` class fix, recap card mount, mono numerals on `PlayerBar` timecode, "Try a sample" double-fire fix, recap API unused → wired.

**Files:** `apps/web/app/(app)/{assistant,settings,podcasts,podcasts/[episodeId]}/page.tsx`, `apps/web/components/player/PlayerBar.tsx`, `packages/ui/src/primitives/StreakRing.tsx`, `apps/web/app/api/ai/recap/route.ts` (consumer), `apps/web/components/library/ImportDropzone.tsx`.

**Verify:** typecheck + lint + test + build.

### Phase F — V1/V2/V3 visual

**Scope:** Bento/cover art (deterministic gradient mesh util), waveform scrubber, equalizer, page header sweep (Display-1 + eyebrow micro-labels on every page), peach active row, count superscripts, hero moments (now-playing card with sanctioned surface→muted gradient). All page headers, modals, and cards updated.

**Files:** every page; new `packages/ui/src/primitives/{WaveformScrubber,Equalizer,CoverArt}.tsx`; `apps/web/components/library/DocCard.tsx`, `apps/web/components/shared/AppHeader.tsx`.

**Verify:** typecheck + lint + test + build.

---

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Token widening breaks existing imports (TypeScript) | Medium | Additive widening; legacy aliases for one release; typecheck gate. |
| E-ink grayscale remap surfaces unexpected accent leaks | Medium | New `themes.test.ts` asserts no coral/lime hex literal survives into e-ink vars. Visual snapshot before/after. |
| Button rebuild touches ~20 call sites | Medium | API shape preserved; visual diff is contained to CSS. |
| KaraokeHighlighter refactor regresses karaoke sync | High | Pre-existing cross-surface test must pass; new test asserts delegated handler. Manual playback smoke test before Phase C closes. |
| Lucide migration inflates bundle (D8: 150KB gzip reader budget) | Medium | `lucide-react` is tree-shakeable; import icons individually; bundle analyzer runs as part of build verify. |
| PlayerBar consolidation regresses playback chrome | High | Phase B keeps `PlayerBar` as canonical; reader delegates via the same props; manual smoke on iOS Safari + Chrome before Phase F closes. |
| Coachmarks mount breaks reader first-paint | Low | Lazy-mount via `IntersectionObserver` after first scroll. |
| Schema migration for `readingSpeed` preference | Low | Add as nullable column on `User`; default `null` (use system default 1.0). No data loss. |

---

## 9. Out of scope (called out so we don't drift)

- Tailwind v4 upgrade (D7 / gotcha #3 — stays v3.4.x).
- Mobile (Expo) and Chrome extension visual restyling. They will consume the same `packages/ui` tokens once this lands; restyling is a separate milestone.
- New features (e.g., multiplayer, billing, social, leaderboard-v2).
- Server-side TTS audio persistence (gotcha #7 — unchanged).
- New auth surface or OpenRouter gateway refactor.
- Schema migrations beyond `User.readingSpeed`.
- Snapshot gating in CI for visual regressions (manual this milestone).

---

## 10. Acceptance criteria

The milestone is "done" when, **in order**:

1. **Verify gate green.** `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build` all pass. No skipped/loosened tests.
2. **All P0 findings (4) verified fixed** by their respective new tests.
3. **All P1 findings (22) verified fixed** by their respective new tests.
4. **All P2 findings (36) verified fixed** by code + tests. P2 work is split across Phases D (sub-44px targets, contrast, `:focus-visible` radius, modal focus, coachmarks), E (honesty copy, `shadow-soft`, recap card, mono PlayerBar timecodes, JS reduced-motion guards), and F (Display-1 header sweep, eyebrow micro-labels, count superscripts). Anything not explicitly listed in §7 Phases D/E/F stays in the existing P2/P3 backlog and is out of scope for this milestone — confirmed at Phase E close.
5. **Token fidelity.** `grep -RnE '#[0-9A-Fa-f]{6}' apps/web/components apps/web/app packages/ui/src/primitives packages/ui/src/themes.ts` returns zero hardcoded hex outside `packages/ui/src/themes.ts` and `tokens.ts`.
6. **E-ink accent remap.** `themes.test.ts` green; manual screenshot of e-ink theme shows grayscale accents only.
7. **AA contrast.** `coral-600` on white = 4.6:1; `--ink-3` (#646871) on canvas = 4.5:1; documented in `themes.ts` JSDoc.
8. **Karaoke smoke.** Manual: paste a 500-word sample, play at 1.0x, confirm no tab stops on words, single click handler, color/bg-only active swap.
9. **Player smoke.** Manual: open a document, change speed, scrub, background the tab, confirm Media Session metadata + speed persist across reload.
10. **Importer smoke.** Manual: paste text, drop a file, fetch a URL — all three return to `/reader/[documentId]` without errors.
11. **Citation smoke.** Manual: ask a question, confirm `[cite:p:s]` renders as CitationPills that anchor to paragraphs.
12. **CHANGELOG entry.** Add a new D-number (next is D40) summarizing the milestone: "Visual Language v2 + UI-UX Audit Remediation — Phase A–F landed; e-ink remaps accents; P0/P1 verified by tests."
