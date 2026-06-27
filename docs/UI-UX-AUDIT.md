# ReadMaxxing — UI/UX Audit

> **Date:** 2026-06-27 · **Scope:** `apps/web` + `packages/ui` (web surface)
> **Method:** Design law (`docs/UI-UX.md`, `docs/DESIGN-SYSTEM.md`, `packages/ui` tokens/themes)
> measured against the *rendered* app (live DOM inspection across Library, Reader,
> Settings, Podcasts; light/dark/sepia themes; desktop + mobile) **and** a 10-lens
> code audit with per-finding adversarial verification (20 agents).
> **Totals:** 80 verified findings — **4 critical · 22 high · 36 medium · 18 low.**

This is a measure of *reality vs. the app's own committed design law*, plus universal
UX/accessibility best practice. The bones are strong; the gap is mostly **last-mile
wiring and polish**, not architecture.

---

## Verdict

ReadMaxxing has an unusually coherent design *system* and an ambitious, well-thought
design *law* — but the shipped product under-delivers on it in three ways: **(1) several
core promises are built-but-not-wired** (import navigation, speed control, media-session,
onboarding, recap), **(2) the reading surface itself fights accessibility and the
"content is the hero" principle** (every word is a focusable button), and **(3) the
honesty/polish layer leaks** (fake greetings, raw IDs and error codes, an e-ink theme
that still shows full-saturation coral). Fix the 4 critical + 22 high items and the app
jumps from "impressive demo" to "ships."

### Scorecard

| Surface | State | Headline issue |
|---|---|---|
| **Reader / karaoke** | 🔴 Needs work | Every word is a `role="button"` (2,060 tab-stops in a 2k-word doc) |
| **Import flow** | 🔴 Broken | Paste/Text/URL imports throw instead of opening the reader (`id` vs `documentId`) |
| **Player** | 🟠 Half-wired | Speed change is silent; no media-session; speed not persisted |
| **Library** | 🟡 Good base | Continue-shelf buried; "Pasted" filter always empty; no recap card |
| **Settings** | 🟢 Strong | Well-chunked; per-section "Save" contradicts "optimistic" claim |
| **AI surfaces** | 🟡 Good base | Raw `[cite:0:2]` markup shown; fake "Hi, Hanna!" greeting |
| **Theming** | 🟠 Convention-only | Accents are hardcoded hex → e-ink can't drop them; contrast fails |
| **Habit layer** | 🟢 Strong | "Never be shamed" copy is excellent; minor reduced-motion gap |
| **Design system** | 🟡 Drifting | Card/Slider/Player/Chip primitives largely unused; recipes copy-pasted |

---

## The six systemic themes

The 80 findings collapse into six stories. Fixing the *theme* fixes many findings at once.

### Theme A — "Built but not wired" (the dominant pattern, and the good news)
A remarkable amount of functionality is fully implemented but never connected to the UI.
This is the highest-leverage theme: most fixes are **wiring, not building**.
- Import navigation reads `out.id`; the API returns `documentId` → every paste/text/URL import **fails at the finish line**. *(critical)*
- `audio.playbackRate` is set once on load and never re-applied → **changing speed does nothing**. *(critical)*
- `MediaSessionWrapper` is complete in `packages/core` with **zero consumers** → no lock-screen / headphone controls.
- `Coachmarks` (the §6 onboarding tour) is **mounted by no page** → first-run guidance never appears.
- `/api/ai/recap` is built and cached but **no UI consumes it** → no "recap on return."
- `Slider`, `Card`, `Player`, `ContinueShelf` primitives exist but are barely/never imported in web.

### Theme B — The reading surface fights the content & a11y
The surface meant to embody "the content is the hero" is the most compromised.
- Every word → `<span role="button" tabIndex={0}>`: **2,060 focusable nodes / 2,060 SR "button" announcements** in a 2k-word doc; the H1 is shredded into 6 buttons; O(n²) render. *(critical)*
- Reading **measure (66ch) is computed against the 15px body** while paragraphs render at 17px → lines overrun the comfortable band; **line-height 1.85 exceeds the 1.65 token ceiling.**
- **Two auto-scrollers fight** (word/center vs sentence/start); neither lands the sentence in the upper third; one ignores reduced-motion.
- Active word toggles **`font-semibold` → per-word reflow** during playback.
- The four reader tool buttons are **filled cards that dominate the mobile screen above the content** (40px, sub-44px target).

### Theme C — The accent/theme system is enforced by convention, not code
Surfaces and text are CSS variables; **accents are hardcoded hex** in the Tailwind config.
- `themeCssVars` emits zero accent vars → **e-ink renders full-saturation coral/butter/mint**, directly contradicting its "no accents" purpose.
- **Contrast failures:** `textTertiary` fails AA on light/sepia canvas (2.68:1 / 2.93:1) and on cards (3.12:1); the primary **coral CTA with white text is 3.06:1 (fails AA)**; `coral-text` fails on any dark surface (3.62:1).
- Hardcoded accent hex duplicated in SVGs (StreakRing, XPBar) and button hovers (`#E54E37`).

### Theme D — Honesty leaks (violates the law's #1 non-negotiable)
The law says "honesty over persuasion — in numbers, in progress, in copy." The UI leaks the opposite.
- Assistant greets **everyone** "Hi, Hanna!" and claims "you opened two long docs today" — fabricated.
- The player shows the **raw ElevenLabs voice ID** `Xb7hH8MSUJpSbSDYk0k2` as the voice name.
- Podcast pages show **raw DB enum tokens** (`reading_doc`, `producing_audio`); a *failed* episode says "come back in a few minutes."
- Errors render **raw HTTP codes** ("documents 503", "save_failed: 500", "Request failed (500)") and **raw Web Speech codes** ("not-allowed").
- "Log out" and "Export data" fire **`alert()` with developer copy** ("Logout wiring lives in the auth provider.").
- "Variable reward unlocked" surfaces the **internal psychology mechanism** as user copy.
- AI answers render **raw `[cite:0:2]` markup** instead of trustable links.

### Theme E — Accessibility gaps beyond the reader
- `CommandPalette` / `KeyboardShortcuts` are div-modals that **don't trap or restore focus** (`Dialog` primitive already does this correctly).
- `DropdownMenu` announces `role="menu"` but has **no arrow-key operability** — worse than no ARIA.
- **No skip-to-content link** anywhere (the CSS is shipped; the link is never rendered).
- **Sub-44px touch targets**: filter chips (28px), toast/coachmark close buttons (28–32px).
- **No `forced-colors` / `prefers-contrast` / `prefers-reduced-transparency` handling** → the box-shadow focus ring **vanishes in Windows High Contrast**.
- The global `:focus-visible` rule **forces every focused element to 10px corners** (pills/cards snap on focus).
- Reduced-motion isn't respected by **JS-driven motion** (auto-scroll `behavior:'smooth'`, StreakRing rAF tween).

### Theme F — Micro-polish & design-system drift
- Redundant readouts (time shown **3×** in the player), competing coral CTAs (two "New podcast" on one screen).
- **Dead utility classes** that silently no-op: `shadow-soft` (3 sites), `coral-bg-soft` (voice clone), `shimmer` keyframe (unused).
- Recipes copy-pasted instead of using primitives (Card used in 1 file; Chip vs DocCard tag colors diverge; 4 hand-rolled range inputs).
- Terminology drift: the same action is "link" / "URL" / "webpage" on one screen.

---

## P0 — Ship-blockers (fix before anyone uses it)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| **C1** | **Paste/Text/URL import never opens the reader** — reads `out.id`, API returns `documentId`; throws "Server returned no document id." The green test masks it (mocks `{id}`). | `ImportDropzone.tsx:194,225,250,302` vs `app/api/import/route.ts:175-184` | Rename `ImportResponse.id`→`documentId`; update the 4 read sites + `router.push(`/reader/${out.documentId}`)`; fix the test mock to return `documentId`. *(S)* |
| **C2** | **Changing speed is silent** — `playbackRate` set only in `onLoadedMetadata`; the speed effect excludes `speed`, never re-applies to the live audio. | `app/reader/[docId]/page.tsx:710`, store `setSpeed` mutates state only | Add `useEffect(() => { if (audioRef) audioRef.playbackRate = speed }, [speed, audioRef])`. *(S)* |
| **C3** | **Karaoke shreds the document into 2,060 focusable buttons** — keyboard trap, SR flood, O(n²) render (a `flat.find()` per word, re-run every word tick). | `packages/ui/src/primitives/KaraokeHighlighter.tsx:171-205,172-174` | Words = plain spans with `data-word-idx`; ONE delegated click handler on the container (`e.target.closest('[data-word-idx]')`); make the container the single focusable reading region + keep `.rmx-live`; use the precomputed `globalIndex` instead of `find`. Existing click test still passes via bubbling. *(M)* |
| **C4** | **AI answers render raw `[cite:0:2]` markup** instead of trustable inline citations — breaks the core AI-trust promise. | `app/api/ai/ask/route.ts:108-112,172-173`; `AskChat.tsx:296-297`; `packages/ai/src/index.ts:400` computes stripped `prose` but never returns it | Return the `prose` field (already computed) and/or tokenize on the cite regex in `ChatBubble`, replacing each `[cite:p:s]` with the existing `↗¶N` pill wired to `onJumpToParagraph`. *(M)* |

---

## P1 — High-impact (the 22 "high" findings)

### Reader & player
- **Reading measure/type** — 66ch measured at 15px body, paragraphs 17px/1.85. Set the `.reading-column` font-size to the reading size before `ch` resolves (or tighten to ~60ch); drop leading to ≤1.6. `KaraokeHighlighter.tsx:104,129` + `globals.css:80-82`. *(S)*
- **Two competing auto-scrollers** — keep one sentence-anchored scroller targeting ~30% viewport height; carry the reduced-motion guard. `page.tsx:243-253` + `reader/ReaderColumn.tsx:41-50`. *(M)*
- **Reader tool buttons dominate mobile** — make inactive toggles recede (transparent until hover/active), bump to 44px, collapse to one overflow button on mobile. `page.tsx:654,662-685,98-114`. *(M)*
- **Speed never persisted** — restore `position.speed` on load; persist per-user. `SpeedControl.tsx:6-9` (docstring overpromises) + `page.tsx:287-293`. *(M)*
- **Media Session wired nowhere** — instantiate `MediaSessionWrapper` on audio-ready for lock-screen/OS controls. `packages/core/src/player/media-session.ts` (zero consumers). *(M)*

### Library & flows
- **Continue-listening shelf is buried** below the importer — render it under the heading (above the importer) when items exist. `library/page.tsx:149-190`. *(M)*
- **"Pasted" filter always returns zero** — `sourceType` is `"paste"` but the chip compares to `"pasted"`. Map label→sourceType explicitly. `library/page.tsx:51,115`. *(S)*
- **Onboarding coachmark is dead code** — never mounted. Mount `<Coachmarks/>` on the reader (it self-gates to first visit). *(S)*

### Theming & contrast
- **Global focus-ring forces 10px corners** on every focused element — delete the `border-radius` line from `:focus-visible`. `globals.css:58-62`. *(S)*
- **E-ink can't drop accents** — promote accents to CSS vars in `ThemeTokens`/`themeCssVars`; map e-ink accents to grayscale. `tailwind.config.ts:43-92` + `themes.ts:125-185`. *(L)*
- **`textTertiary` fails AA** on light/sepia canvas (2.68/2.93) — darken to ~`#646871` (light) / ~`#75643F` (sepia). `themes.ts:68,112`. *(S)*
- **Coral CTA white text is 3.06:1 (fails AA)** — add a `coral-bg-strong` ~`#D83A22` (4.62:1) for body-size button fills. `Button.tsx:20` + call sites. *(M)*

### Accessibility
- **Modals don't trap/restore focus** (CommandPalette, KeyboardShortcuts) — reuse the `Dialog` primitive (native `<dialog>.showModal()`). *(M)*
- **`DropdownMenu` `role="menu"` isn't arrow-operable** — add roving focus, or drop the menu ARIA. *(M)*
- **No skip-to-content link** — add it in `layout.tsx`; give each `<main>` `id="main"`. *(S)*

### Content honesty
- **Fake "Hi, Hanna!" + "two long docs today"** — bind to real session or use a neutral line. `assistant/page.tsx:103-110`. *(M)*
- **Raw voice ID shown as the voice name** — resolve id→name. `page.tsx:768`, `PlayerBar.tsx:238,259`. *(S)*
- **Raw podcast enum status + "come back" lie on failure** — map to friendly labels; add a real `failed` branch with Retry. `podcasts/[episodeId]/page.tsx:212`. *(M)*
- **`alert()` with dev copy on Log out / Export** — wire the real action or hide it; replace alerts with inline state. `settings/page.tsx:167,410`. *(M)*
- **Raw Web Speech error codes** shown ("not-allowed") — map to human copy. `VoiceInput.tsx:158-159,263-264`. *(S)*

### Architecture
- **Three parallel player implementations** — the rendered `PlayerBar` has drifted from the unused `Player` primitive (a11y wins + skips exist only on the bar). Consolidate to one source of truth. *(L)*

---

## Full catalog (all 80, by domain)

> Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low. Each row: evidence → fix.

### Reader & karaoke
- 🔴 **Per-word `role=button`** — `KaraokeHighlighter.tsx:171-205` → delegated click + plain spans (C3).
- 🟠 **66ch measured at wrong font-size; leading 1.85** — `KaraokeHighlighter.tsx:104,129`, `globals.css:80-82` → set column font-size / tighten to 60ch; leading ≤1.6.
- 🟠 **Two competing auto-scrollers** — `page.tsx:243-253` + `reader/ReaderColumn.tsx:41-50` → one sentence scroller, upper-third target, reduced-motion guard.
- 🟠 **Tool buttons dominate mobile, 40px targets** — `page.tsx:654,662-685,98-114` → recede inactive, 44px, mobile overflow menu.
- 🟡 **Active word `font-semibold` reflow** — `KaraokeHighlighter.tsx:184-191` → emphasize by color/bg only.
- 🟡 **Progress readout 11px/muted + over-announcing live region** — `ProgressRail.tsx:40-45` → `text-sm`/`text-ink`; throttle aria-live to whole-percent.
- 🟡 **"Listen from here" matches wrong word via `includes()`** — `page.tsx:786-793` → resolve selection start to `[data-word-idx]` → `seekTimeForWordIndex`.
- ⚪ **Reading ruler is a 1px coral, pointer-only** — `ReadingRuler.tsx:27-43` → thicken, theme-token color, drive from active sentence.
- ⚪ **Dead `FocusMode.tsx`/`BionicText.tsx` (48px) diverge from live 40px toggle** → delete; standardize the live toggle at 44–48px.

### Player & transport
- 🔴 **Speed change silent** — `page.tsx:710` → re-apply `playbackRate` on `[speed]` (C2).
- 🟠 **Speed never persisted/restored** — `page.tsx:287-293`, `SpeedControl.tsx:6-9` → restore `position.speed`; persist per-user.
- 🟠 **Media Session unused** — `packages/core/src/player/media-session.ts` → instantiate on audio-ready.
- 🟡 **Four ±15/±30 skips crowd the play button (desktop)** — `PlayerBar.tsx:135-189` → move skips into the ⋯ menu; enlarge play.
- 🟡 **Time shown up to 3×** — `PlayerBar.tsx:126-130,203-208,319-321` → keep one canonical readout.
- 🟡 **Status pills float over content & can overlap** — `page.tsx:724-746,771-778` → render inside/above the PlayerBar, not floating.
- 🟡 **Raw 4px range scrubber, no buffered cue; Slider primitive unused** — `PlayerBar.tsx:302-318` → thicker track ≥16px thumb + 40px hit row; add `audio.buffered` layer.
- ⚪ **Touch parity gap (prev-sentence/repeat) + low shortcut discoverability** — `page.tsx:500-588` → expose in ⋯ menu; one-time `?` coachmark; delete dead `Player.tsx` shortcut copy.
- ⚪ **No replay / end-of-document affordance** — `page.tsx:715-718` → seek-to-0 on replay or end-card with Replay/Next.

### Design-token fidelity
- 🟠 **Global `:focus-visible` forces 10px corners** — `globals.css:58-62` → delete the `border-radius` line.
- 🟠 **E-ink can't drop accents (hardcoded hex)** — `tailwind.config.ts:43-92`, `themes.ts:125-185` → accents as CSS vars; e-ink → grayscale.
- 🟡 **Streak/XP rings hardcode accent hex in SVG** — `StreakRing.tsx:69,141`, `XPBar.tsx:82` → import `brand`/`semantic` token constants.
- 🟡 **Button hover uses off-palette hex** `#E54E37`/`#B82626` — `Button.tsx:20,28` → token-derived darken or `brightness-90`.
- ⚪ **Error surface hardcodes `#FBE9E7`** — `VoiceCloneFlow.tsx:231` → `bg-danger-soft`.

### Color, theming & contrast
- 🟠 **`textTertiary` fails AA on canvas (light 2.68 / sepia 2.93)** — `themes.ts:68,112` → darken to ~`#646871` / ~`#75643F`.
- 🟠 **Coral CTA white text 3.06:1 (fails AA)** — `Button.tsx:20` + call sites → `coral-bg-strong` ~`#D83A22` (4.62:1).
- 🟠 **E-ink renders full-saturation accents** — same root as token finding → theme-var accents, e-ink grayscale.
- 🟡 **`coral-text` 3.62:1 on dark (fails); 4.50–4.56 on warm (no headroom)** — `tailwind.config.ts:46` → theme-aware; warm ~`#B82E18`, dark lighter coral.
- 🟡 **`textTertiary` fails 4.5:1 on cards (3.12 light/sepia, 4.32 dark)** — `themes.ts:68/62,112/104,90/82` → same tertiary darkening drives card too.
- ⚪ **Coral focus ring fixed 35%-alpha on all themes (faint on lightest; coral in e-ink)** — `globals.css:60` → theme via `--focus-ring`; solid ink ring in e-ink.

### Accessibility (global)
- 🟠 **Div-modals don't trap/restore focus** — `CommandPalette.tsx:47-60`, `KeyboardShortcuts.tsx:55-68` → use `Dialog` primitive / add trap+restore+`inert`.
- 🟠 **`DropdownMenu` `role=menu` not arrow-operable** — `DropdownMenu.tsx:80-117` → roving focus or drop menu ARIA.
- 🟠 **No skip-to-content link** — `layout.tsx:43-53` → add link + `id="main"` on each `<main>`.
- 🟡 **Sub-44px targets** (chips 28px, toast/coachmark close 28–32px) — `library/page.tsx:206`, `Toast.tsx:87`, `Coachmarks.tsx:103`, `VoicePicker.tsx:131` → ≥44px hit area.
- 🟡 **`reader/ReaderColumn.tsx:49` smooth scroll ignores reduced-motion** (+ `page.tsx:832`) → gate `behavior` on `matchMedia`.
- 🟡 **No `forced-colors`/`prefers-contrast`/`prefers-reduced-transparency`** — focus ring vanishes in High Contrast — `globals.css` → add media blocks; outline-based ring under forced-colors.
- ⚪ **Nested live regions in Toast** — `Toast.tsx:51-53,112-114` → keep per-toast `role=status`, drop region `aria-live`.
- ⚪ **Tooltip no Escape-dismiss + `pointer-events-none`** — `Tooltip.tsx:58-83` → Escape handler; keep labels non-essential.

### Library, IA & flows
- 🔴 **Import never navigates (`id` vs `documentId`)** — `ImportDropzone.tsx:194,225,250,302` (C1).
- 🟠 **Continue-shelf buried below importer** — `library/page.tsx:149-190` → shelf-first when non-empty.
- 🟠 **"Pasted" filter always empty** — `library/page.tsx:51,115` → map label→sourceType.
- 🟠 **Coachmark onboarding never mounted** — `Coachmarks.tsx` → mount on reader.
- 🟡 **Doc cards hide progress & recency** (3 identical "Deb Playbook" cards) — `DocCard.tsx`, `page.tsx:240-248` → pass `addedAt` + `percent`.
- 🟡 **Continue-shelf empty copy points to "home page" = this page; stale `/marketing`** — `ContinueShelf.tsx:64`, `app/page.tsx:4-7` → accurate copy.
- 🟡 **"Try a sample" double-fires + silent clipboard write; empty grid has no CTA** — `library/page.tsx:161-180,229-235` → busy state, drop clipboard, add CTA.
- 🟡 **No recap card on return (API exists)** — `api/ai/recap` unused → surface cite-linked recap on top shelf item.
- ⚪ **Doc-grid error is a raw string dead-end, skeleton lacks live semantics** — `library/page.tsx:103,219-228` → human error + Retry; `role=status`/`aria-busy`.

### Motion & micro-interactions
- 🟡 **Active word `font-semibold` reflow / CLS** — `KaraokeHighlighter.tsx:190-191` → color/bg only.
- 🟡 **`shadow-soft` undefined → hover elevation no-ops** — `DocCard.tsx:74`, `podcasts/page.tsx:275`, `page.tsx:728` → add the token or use `shadow-sm/md`.
- 🟡 **StreakRing rAF tween ignores reduced-motion** — `StreakRing.tsx:46-66` → `matchMedia` early-return.
- 🟡 **Auto-scroll `behavior:'smooth'` overrides reduced-motion** — `reader/ReaderColumn.tsx:49` → gate behavior.
- ⚪ **`animate-spin` loaders freeze mid-rotation under reduced-motion** — `Button.tsx:77`, `PlayerBar.tsx:165`, `page.tsx:732` → pair with status text.
- ⚪ **VoicePicker `transition-all` no token** — `VoicePicker.tsx:93` → `transition-[…] duration-fast ease-out`.
- ⚪ **Dead `shimmer` keyframe** — `tailwind.config.ts:160-171` → remove or adopt for skeletons.

### Content design & microcopy
- 🟠 **Fake "Hi, Hanna!" + invented stats** — `assistant/page.tsx:102-110` → real session / neutral line.
- 🟠 **Raw ElevenLabs voice ID shown** — `page.tsx:768`, `PlayerBar.tsx:238,259` → resolve id→name.
- 🟠 **Raw podcast enum status; "come back" on `failed`** — `podcasts/[episodeId]/page.tsx:212`, `podcasts/page.tsx:323` → friendly labels + failed branch.
- 🟠 **`alert()` dev copy on Log out / Export** — `settings/page.tsx:167,399,402,410` → real action / inline state.
- 🟠 **Raw Web Speech error codes** — `VoiceInput.tsx:158-159,263-264` → map to human copy.
- 🟡 **Raw HTTP codes in errors** ("documents 503", "save_failed: 500") — `library/page.tsx:97,103,220`, `settings/page.tsx:91,96,117,120` → human line + Retry.
- 🟡 **"Request failed (500)" leaks in PodcastCreator** — `PodcastCreator.tsx:197,227,374` → human fallbacks.
- 🟡 **"Variable reward unlocked" jargon** — `PodcastCreator.tsx:709` → warm plain line.
- 🟡 **Assistant Context card leaks raw IDs + "debounce"** — `assistant/page.tsx:197,213-231` → real picker / plain language.
- ⚪ **"Phase 6 (…)" internal roadmap in About** — `settings/page.tsx:444` → drop the phase label.
- ⚪ **"link" / "URL" / "webpage" inconsistency** — `library/page.tsx:51,154,233`, `ImportDropzone.tsx:32,382` → pick one ("link").
- ⚪ **Dead `Player.tsx` would leak raw provider errors** — `player/Player.tsx:133` → delete or guard.

### Component architecture & consistency
- 🟠 **Three parallel player implementations; PlayerBar drifted from primitive** — consolidate to one source of truth.
- 🟡 **Dead `player/Player.tsx` + `player/KaraokeHighlighter.tsx` (latent type bug)** — delete orphans.
- 🟡 **DocCard re-implements Chip tag with paler tokens** — `DocCard.tsx:37-44` → use `<Chip>`; reconcile color.
- 🟡 **`Card` primitive used in 1 file; recipe copy-pasted; modals drift to 28px** — adopt `<Card>`; normalize radius.
- ⚪ **Four hand-rolled range inputs; `Slider` unused** — consolidate onto one range primitive.
- ⚪ **Raw coral CTAs bypass `Button`** (QuizCard, PodcastCreator, PlayerBar play) — use `<Button>`/`<Button iconOnly>`.

### AI surfaces & habit layer
- 🔴 **Raw `[cite:0:2]` markup in AI answers** — `ask/route.ts`, `AskChat.tsx:296-297`, `index.ts:400` (C4).
- 🟡 **`coral-bg-soft` class doesn't exist → unstyled done-pills/success card** — `VoiceCloneFlow.tsx:262,471` → `coral-soft`.
- 🟡 **Habit/voice primitives hardcode hero/semantic hex** — `StreakRing.tsx:69,141`, `XPBar.tsx:82`, `VoiceCloneFlow.tsx:231` → token constants.
- 🟡 **Recap API built, no UI consumer** — wire a dismissible recap card.
- 🟡 **Assistant hero fabricates name/activity** — `assistant/page.tsx:103,106` (dup of content finding).
- 🟡 **Ask chat can't Stop a slow stream or Retry a failure** — `AskChat.tsx:161,175,234,253,258` → AbortController + Retry button.
- 🟡 **StreakRing reduced-motion** (dup of motion finding).
- 🟡 **Summary bullet citations positionally mismatched** — `SummaryPanel.tsx:161-163,178` → per-bullet citations.
- ⚪ **Quiz result lacks score ladder / review-missed** — `QuizCard.tsx:144-162` → score ring + "Review missed (N)".

---

## Prioritized roadmap

**P0 — Ship-blockers (≈1 day).** C1 import (S), C2 speed (S), C3 per-word buttons (M), C4 cite markup (M). These four are the difference between "broken demo" and "works."

**P1 — Core-promise wiring + a11y (≈3–4 days).** Media-session (M), speed persistence (M), continue-shelf order (M), "Pasted" filter (S), mount coachmarks (S), focus-ring radius (S), modal focus trap (M), skip link (S), DropdownMenu keys (M), contrast pass — tertiary + coral CTA + coral-text (S–M), reader measure/leading (S), dual-scroller (M).

**P2 — Theme system + honesty + polish (≈3–4 days).** Promote accents to CSS vars so e-ink truly drops them (L, unlocks several findings), all the honesty/copy fixes (greeting, voice-id, statuses, errors, alerts — mostly S), `shadow-soft` token, reduced-motion for JS motion, redundant time/CTA cleanup, recap card.

**P3 — Design-system consolidation (ongoing).** Collapse the three player impls + scrubber/Slider/Card/Chip/Button into single sources of truth; delete the ~5 dead components; standardize range inputs. This is the durable fix that stops drift recurring.

---

## What's already strong (don't lose it)

- **The design law itself** (`UI-UX.md`) is genuinely excellent — psychology-grounded, specific, honest.
- **Theme tokens + 4 themes** are well-modeled; the switcher works; dark is correctly true-dark.
- **Settings** is well-chunked (presets over raw sliders, per the Choice-Paradox rule) with an "Auto" theme.
- **Habit copy** nails "pressure without shame" — "One-tap private mode. You'll never be shamed for opting out." is exactly right.
- **The importer-open-by-default** zero-friction landing is the correct call.
- The `Dialog` primitive (native `<dialog>`) and the `.rmx-live`/`.sr-only-focusable` CSS show the a11y *intent* is there — it just needs to be the default path everywhere.

---

## Methodology

Rendered-app inspection (live DOM measurement of role/tabindex counts, computed type/measure,
theme switching, light/dark/sepia, desktop + mobile) combined with a 10-lens parallel code
audit (reader, player, tokens, contrast, a11y, library/IA, motion, content, architecture,
AI/habit). Every finding was independently re-verified against the cited `file:line`;
2 false positives were rejected, and several severities/fix-values were corrected during
verification (e.g. contrast remediation hexes recomputed to actually clear AA; dead-code
findings downgraded). Contrast ratios use the WCAG 2.x relative-luminance formula.

---
---

# Part II — Visual Design Direction ("the premium layer")

> **Added 2026-06-27** per the request to match a reference aesthetic (a premium
> editorial reading/audio app) and to fix the "design system isn't polished / icons
> aren't great / buttons are inconsistent / feels clunky and incomplete" problem.
> **Good news first:** the *palette* already matches the reference — coral +
> warm off-white + ink. This is **not a rebrand.** The gap is **craft**: shape
> language, icon set, type scale, layout rhythm, and depth. Part I fixes what's
> *broken*; Part II makes it *feel expensive*.

## Why the reference reads as premium (and we don't, yet)

A diagnosis of the reference, distilled into principles we can build against:

1. **Type is the hero, not the chrome.** Oversized, tight-tracked bold display titles
   ("Content", "Wisdom Tree") paired with **thin giant numerals** ("47", "06 : 52").
   The contrast between an 800-weight title and a 200-weight numeral is the signature.
2. **One strict shape language.** *Every* interactive element is a **pill or a circle.**
   Primary = solid pill (ink or coral), secondary = white/surface pill, tools = circular
   icon buttons. Zero rounded-rectangles-with-text. This single rule is ~80% of "looks designed."
3. **A real, refined icon set** — thin, consistent-stroke line icons (sliders, search,
   menu, ↗, bookmark, +). No emoji, no text glyphs.
4. **Bold, confident coral.** Coral isn't timid — it goes **full-bleed** (entire hero
   screens), becomes feature tiles, becomes numerals. One accent, used fearlessly.
5. **Bento / editorial layout** — asymmetric mosaics with cover imagery, not uniform
   grids of text.
6. **Depth, used sparingly** — a subtle white→cream gradient on the now-playing card,
   soft elevation, ghosted/faded "next" items for layering.
7. **Media-app motifs** — equalizer bars, count badges, the ↗ "open" affordance,
   progress rendered as bold coral.

**ReadMaxxing today breaks 1–6.** Concretely, from the live app: header tools are
**white rounded *squares* with unicode/emoji glyphs** (`☀ Light`, `B`, `▤`, `?`); buttons
mix `rounded-md` squares, pills, and bespoke coral fills at **four different heights**
(`h-10` / `h-12` / `h-14` / `h-16`); the play control is a rounded *square*; cards are
**text-only** with no cover art in a flat uniform grid; coral appears only on small CTAs;
and there's **no elevation at all** (the one shadow token, `shadow-soft`, is undefined —
Part I, Motion). That combination is exactly what reads as "clunky and incomplete."

---

## The system upgrades

### 1. Icons — adopt Lucide; delete every glyph *(the single highest-impact change)*

The app has **no icon library** — it renders icons as unicode/emoji/text characters. This
is the #1 "not polished" signal. Adopt **Lucide** (`lucide-react`; `lucide-react-native`
exists for the extension/mobile, so it's cross-surface consistent). Lucide's 1.5–2px
open-stroke style **is** the reference's icon style — the reference's filter glyph is
literally Lucide `SlidersHorizontal`, and its card "open" arrow is `ArrowUpRight`.

**Rules:** one stroke width (`1.75`), two sizes (`20` inline / `24` chrome), `currentColor`
fill, every icon-only button gets `aria-label`.

| Current (glyph/text) | Where | → Lucide |
|---|---|---|
| `☀ / ☾ / ✦ / ▤` theme | `ThemeSwitcher.tsx:110` | `Sun` / `Moon` / `Coffee` / `Contrast` (+ `SunMoon` for Auto) |
| `B` bionic, circle, grid, `?` | reader tools `page.tsx:662-685` | `Sparkles`(bionic) / `ScanEye`(focus) / `Ruler`(guide) / `Keyboard`(shortcuts) |
| search / help glyphs | `AppHeader.tsx` | `Search` / `HelpCircle` |
| filter | library/settings | `SlidersHorizontal` |
| `→` / `↗` text arrows | cards, "try a sample" | `ArrowRight` / `ArrowUpRight` |
| play/pause/skip text | `PlayerBar.tsx` | `Play` / `Pause` / `RotateCcw`+`RotateCw` (skip ±) |
| voice label | `PlayerBar.tsx:259` | `AudioLines` (+ resolved voice *name*, Part I) |
| menu / close / plus | shared | `Menu` / `X` / `Plus` |
| bookmark | (new) | `Bookmark` |

Wrap them in **one** `<Icon>` component so size/stroke/`aria` stay consistent, and a single
circular `<IconButton>` container (below). *Removing the emoji theme glyphs and the white
square icon buttons alone will visibly lift the whole app.*

### 2. Shape language & the button system *(fixes "buttons are inconsistent")*

Collapse every button into **one system, two shapes: pill + circle.** Rebuild
`packages/ui/src/primitives/Button.tsx` (currently `rounded-md`) and add an `IconButton`.

**`<Button>` — pill (`rounded-full`), one height per size (sm 36 / md 44 / lg 52):**

| Variant | Fill | Use | Replaces |
|---|---|---|---|
| `primary` | `coral-strong` (#D83A22, AA-safe — Part I) + white | the one hero CTA per screen | "Choose file", "New podcast" |
| `inverse` | ink (#0E0F12) + warm-white | contextual primary on busy/coral surfaces ("Pause", "Menu") | the black pills in the reference |
| `secondary` | surface/card + hairline border | secondary actions ("Scan an image", "Log out") | the white `rounded-md` squares |
| `ghost` | transparent + hover tint | tertiary / inline | text links acting as buttons |

**`<IconButton>` — circle (`rounded-full`, 1:1), sizes 36 / 44 / 56:**
- `surface` (soft `surface-muted` fill — the reference's filter button), `ghost`, `inverse`, `coral`.
- **The header tools, theme switcher, reader tools, and help all become circular `IconButton`s** — delete the `rounded-md bg-card` squares.
- **The play control becomes a large coral circle (56–64px)** with a `Play`/`Pause` icon, not a rounded square. Skips become 44px ghost circles.

**Kill the hardcoded hover hexes** (`#E54E37`/`#B82626`, Part I) — derive hover from the
base token. One `active:scale-[0.97]` press across all buttons. After this, *every* button
in the app shares radius, height rhythm, focus ring, and motion.

### 3. Typography — editorial scale + thin numerals *(the "hero is type" move)*

Stay within the "Inter only" law but unlock its editorial register:
- **Turn on optical sizing for headings:** `font-optical-sizing: auto` (Inter Display
  metrics) + tighten display tracking to `-0.03em`. `tokens.ts` already defines a `display`
  (80px) and `mega` (120px) scale that the screens don't use — **use them.** Push page H1s
  ("Your library", "Settings", the reader title) up a step and to weight **800**.
- **Add a "stat numeral" style** — weight **200–300**, size `display`/`mega`, `tabular-nums`,
  tracking `-0.02em` — for the streak count, daily-goal numbers, "X new", and the player
  clock. This thin-giant-numeral-against-bold-title contrast is the reference's signature and
  costs nothing (it's already Inter).
- Body/reading: hold at 16–18px / 1.5–1.6 (Part I) — calm, not editorial. The drama lives in
  titles and numerals, never in the reading column.

### 4. Color & depth *(use coral bravely; add real elevation)*

- **Use coral at full-bleed**, not just on chips: a coral hero band on the library or
  empty-state, a coral "now playing" header on the reader, coral stat numerals. One bold
  accent per screen — the law already says this; we just under-use it.
- **Define an elevation scale and actually use it.** `shadow-soft` is referenced but
  undefined (Part I). Add `elev-1: 0 1px 2px rgba(14,15,18,.04)`, `elev-2: 0 4px 16px
  rgba(14,15,18,.08)`, `elev-3: 0 12px 32px rgba(14,15,18,.12)` to `tailwind.config.ts`.
  Cards rest at `elev-1`, lift to `elev-2` on hover, sheets/menus use `elev-3`. Instant
  "finished" feeling.
- **Sanction one tasteful gradient pattern**: a subtle surface→muted (white→cream) gradient
  on hero/now-playing/cover surfaces only — never on text or controls. Add it to
  DESIGN-SYSTEM as an intentional exception so it isn't ad-hoc.

### 5. Cards, bento & cover art *(fixes "feels incomplete")*

- **Generate cover art.** Documents have none, which is why the library looks like a
  spreadsheet. Add a deterministic generated cover per doc keyed by `docId` — an abstract
  coral/ink gradient-mesh or generative pattern (and OG-image fetch for URL imports). This
  is the biggest single "feels like a real product" win.
- **Bento the library.** Replace the uniform grid with an asymmetric mosaic: a 2-col
  **featured tile** for the most-recent/in-progress doc (big cover + 800-weight title +
  progress), smaller tiles, **one coral feature tile**, and the `↗` (`ArrowUpRight`) open
  affordance top-right of each card. `library/page.tsx`, `DocCard.tsx`.
- **Upgrade `DocCard`:** editorial bold title, cover, **progress as a coral ring** (reuse
  the `StreakRing` arc) rather than a thin rail, source as a small pill, relative date
  (Part I wires `addedAt`/`percent`).
- **Now-playing card:** surface→cream gradient, voice avatar, **equalizer motif**, pill
  transport — exactly the reference's bottom card.

### 6. Motifs that signal "media app"

- **`↗` open affordance** on every card (top-right).
- **Live equalizer bars** on the currently-playing item (drive 4–6 bars off the audio; this
  is cheap and instantly reads as "audio").
- **Count badges** on filter pills / menu (e.g. "All · 12").
- **Ghosted next-item** — render the next category/chapter at ~30% opacity behind the active
  one for depth (the reference's faded "Sci-Fi").
- **Giant thin numerals** for every meaningful stat.

### 7. The player, visually

Redesign `PlayerBar` to the reference's confidence: a **large coral circular Play/Pause**,
**ghost circular skips** (icons, in the ⋯ menu on desktop per Part I), a **coral scrubber
with a draggable dot + buffered track**, a **thin giant numeral clock**, a **voice pill**
(avatar + resolved name + `AudioLines`), and the **equalizer** while playing. One canonical
time readout (Part I kills the 3× redundancy). On the reader, consider the reference's
split black/coral player panel for the immersive "now playing" state.

---

## Prioritized visual workstream

**V0 — Foundations (the 70% win, ≈2–3 days).** Lucide + `<Icon>`/`<IconButton>`; rebuild
`Button` as the pill system; delete the rounded-square chrome; turn on heading optical
sizing + push H1s to the display scale; add the elevation scale + define `shadow-soft`.
*After V0 alone the app stops feeling clunky* — it's all system-level, touches every screen.

**V1 — Cards & library (≈2–3 days).** Generated cover art; bento mosaic; `DocCard` with
cover + progress ring + `↗`; stat numerals on the habit/streak surfaces.

**V2 — Player & motifs (≈2 days).** Player visual redesign; equalizer; now-playing gradient
card; count badges; ghosted next-item.

**V3 — Hero moments (≈1–2 days).** Full-bleed coral hero on library/empty-state and the
reader "now playing"; the split-panel immersive player; first-run polish.

**Net effect:** same palette, same Next/Tailwind stack, ~no new deps beyond Lucide — but the
app moves from "functional prototype" to the editorial, confident, premium feel of the
reference. V0 is almost entirely find-and-replace at the design-system layer, so the lift
propagates to every screen (and, via `@readmaxxing/ui`, to the extension and mobile too).

---

## Part II.b — v2 visual spec & change-list (what to change, by file)

> The full, canonical visual language now lives in **`docs/DESIGN-SYSTEM.md` §25
> (Visual Language v2 — Editorial-Minimal Refresh)**. This section is the audit's
> *delta*: the concrete changes to make, mapped to files. New since the first pass
> (from the second reference set): **mono/instrument numerals, count superscripts,
> the waveform scrubber, editorial list rows, stat tiles, eyebrow micro-labels, a
> lime secondary accent, and the "peach" active-row pattern.**

### Foundations — design-system layer (do first; lifts every screen)

| Change | Files | Spec |
|---|---|---|
| **Add the coral ramp + lime accent + elevation + radius + mono** as CSS vars/Tailwind | `packages/ui/src/tokens.ts`, `packages/ui/tailwind.config.ts`, `packages/ui/src/globals.css`, `packages/ui/src/themes.ts` | §25.1, §25.3, §25.10 |
| **Accents → CSS vars** so e-ink can drop them (also fixes Part I e-ink finding) | `themes.ts` (`themeCssVars`), `tailwind.config.ts:43-92` | §25.1 |
| **Define `--elev-1/2/3`; alias `soft`→`elev-2`** (fixes dead `shadow-soft`) | `tailwind.config.ts` boxShadow | §25.3 |
| **Add `--font-mono` (Geist Mono)** + load the webfont | `packages/ui/src/fonts.ts`, `apps/web/app/layout.tsx` | §25.2 |
| **Turn on heading optical sizing + weight 800 display** | `globals.css`, heading utilities | §25.2 |
| **Delete the global `:focus-visible` radius override** (Part I) | `globals.css:58-62` | §25.3 |

### Icons — adopt Lucide, delete every glyph

| Change | Files |
|---|---|
| Add `lucide-react`; build one `<Icon>` + circular `<IconButton>` primitive | `packages/ui/src/primitives/` (new `Icon.tsx`, `IconButton.tsx`) |
| Replace theme emoji `☀☾✦▤` | `apps/web/components/shared/ThemeSwitcher.tsx:110` |
| Replace reader-tool glyphs `B / ○ / ▤ / ?` | `apps/web/app/reader/[docId]/page.tsx:662-685` (+ delete dead `FocusMode.tsx`,`BionicText.tsx`) |
| Replace header search/help/filter glyphs | `apps/web/components/shared/AppHeader.tsx`, `settings`/`library` filter buttons |
| Replace text arrows `→ ↗` with `ArrowRight`/`ArrowUpRight` | `DocCard.tsx`, `library/page.tsx` ("try a sample"), all card "open" affordances |
| Player transport/voice/bookmark icons | `apps/web/components/player/PlayerBar.tsx` |

### Buttons — collapse to the pill + circle system

| Change | Files |
|---|---|
| Rebuild `Button` as pill (`--r-pill`), variants primary/inverse/secondary/ghost, sizes 36/44/52; remove hardcoded hover hexes | `packages/ui/src/primitives/Button.tsx` (currently `rounded-md`, `#E54E37`/`#B82626`) |
| Add `IconButton` (circle) variants surface/ghost/inverse/coral | new `packages/ui/src/primitives/IconButton.tsx` |
| Replace the white `rounded-md` square chrome buttons with circular `IconButton` | reader header `page.tsx`, `AppHeader.tsx`, `ThemeSwitcher.tsx` |
| Hero **play → coral circle/squircle 64-72px**; skips → 44px ghost circles | `PlayerBar.tsx:135-189` |
| Route bespoke coral `<button>`s through `Button variant="primary"` | `QuizCard.tsx:159,295`, `PodcastCreator.tsx:526` |

### Typography — editorial scale + mono numerals

| Change | Files |
|---|---|
| Page H1s → Display-1 (800, tight, optical); section heads → Display-2 with right-aligned "Total NN" mono meta | `library/page.tsx`, `settings/page.tsx`, `podcasts/page.tsx`, reader title `page.tsx` |
| **Mono + tabular** for all timecodes, counts, "N tracks/words", stat numbers | `PlayerBar.tsx`, `DocCard.tsx`, `ProgressRail.tsx`, habit primitives |
| **Count superscripts** on tabs/filters ("Featured¹²", "All · 12") | `library/page.tsx` filter row, category navs |
| **Eyebrow micro-labels** (UPPERCASE, tracked) above sections ("NOW PLAYING", "NEXT", "CONTINUE") | reader header, library section heads |
| **Giant numeral** treatment (thin or mono) for streak/daily-goal/clock | `StreakRing.tsx`, `XPBar.tsx`, player clock |

### Cards, lists & layout — bento + covers + editorial rows

| Change | Files |
|---|---|
| **Generate per-doc cover art** (deterministic gradient mesh by `docId`; OG image for URLs) | new util in `packages/ui` or `apps/web/lib`; consumed by `DocCard.tsx` |
| **Bento the library** (featured tile + asymmetric mosaic + one coral tile + `↗`) | `apps/web/app/(app)/library/page.tsx`, `DocCard.tsx` |
| **Editorial list rows** (thumb + title + mono meta + **peach active row**) for continue-shelf / track lists | `ContinueShelf.tsx`, `DocCard.tsx` |
| **Stat tiles** ("X new", "Total N") with micro-label + giant mono numeral | library/podcasts headers, habit surfaces |
| **Now-playing card**: surface→cream gradient, avatar, equalizer, pill transport, `↗` | reader mini-player, `PlayerBar.tsx` |
| Adopt `<Card>`/`<Chip>` primitives; normalize modal radius 28→ per scale | `DocCard.tsx` (own tag recipe), `CommandPalette.tsx`, `KeyboardShortcuts.tsx` |
| Use `--elev-1` rest / `--elev-2` hover lift on all cards | global card usages |

### Player — waveform + instrument readouts

| Change | Files |
|---|---|
| Replace the 4px native range with a **waveform scrubber** (played ink / upcoming 24% / coral playhead + mono timecode bubble); add buffered layer | `PlayerBar.tsx:302-318` |
| **Equalizer** while playing (coral bars, `aria-hidden`, reduced-motion frozen) | `PlayerBar.tsx`, now-playing card |
| One canonical **mono clock**; kill the 3× time redundancy (Part I) | `PlayerBar.tsx:126-130,203-208,319-321` |
| Voice as a **pill** (avatar + resolved name + `AudioLines`) — not a raw id (Part I) | `PlayerBar.tsx:238,259` |

### States & motifs

| Change | Files |
|---|---|
| **Locked/premium empty state** = `EyeOff` icon + honest line + `secondary` pill | wherever gated content appears |
| Aspirational empty states with a CTA (Part I) — library grid, continue-shelf | `library/page.tsx`, `ContinueShelf.tsx` |
| **Avatar stacks** + mono "+N" for social counts | leaderboard / habit / "people reading" surfaces |
| Reduced-motion guards on all JS motion (waveform, equalizer, auto-scroll, StreakRing) | `PlayerBar.tsx`, `reader/ReaderColumn.tsx:49`, `StreakRing.tsx` |

### Sequencing (unchanged from Part II): **V0 foundations → V1 cards/library → V2 player/motifs → V3 hero moments.** V0 (tokens + Icon/IconButton + Button + type + elevation) is the highest-leverage and is mostly design-system find-and-replace.
