# ReadMaxxing — Changelog & Decision Log

All notable changes to ReadMaxxing are recorded here. New agents and humans:
read this file first to understand *what was built, why it was built that way,
and what tradeoffs were accepted*.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/) with
an added "Decisions" section per release that captures the why behind the what.

> **Companion docs:** `README.md` (orientation), `docs/DESIGN-SYSTEM.md`
> (canonical design law — tokens + primitives reference), `docs/UI-UX.md`
> (AI-product rules pointer — visual decisions deferred to DESIGN-SYSTEM),
> `docs/IMPLEMENTATION-STATUS.md` (live phase tracker). When this file
> disagrees with `docs/IMPLEMENTATION-STATUS.md`, the status file wins —
> it tracks current state; this file records history.

---

## [Unreleased] — Operating build (2026-06-25 to 2026-06-26)

### What changes next
- Phase 7 (post-launch): on-device Piper/Kokoro for offline TTS
  (swap `expo-av` for `react-native-sherpa-onnx`), Privy native auth
  in the Expo app, push notification certs for APNs / FCM.
- Railway deploy: the **Prisma engine binary** and **`.env`** post-build
  copy steps (D34 / D35) must be added to `railway.toml` before the
  first production deploy — without them every DB-touching route
  will 500 with `PrismaClientInitializationError`.

### Added — Operating build (2026-06-25 to 2026-06-26)

The web app, Chrome extension, and Expo mobile app all picked up the
canonical M-Chef design system, the `ImportDropzone` was rewritten to
expose three visible input modes (File / Text / URL) instead of
drag-drop only, and the local Postgres + Redis data layer is wired
end-to-end with a real Prisma client. The information architecture
and feature surface from Phases 2–6 are otherwise untouched.

**Design system — M-Chef reskin (wholesale visual replacement):**
- New visual law: **coral** `#FF5C44` primary, **butter** `#F5C84C`
  / **lavender** `#B5A6FF` / **mint** `#7FE3B0` accents, Inter-only,
  20px card radius, 48px buttons, 3px coral halo focus ring, tabular
  figures on `<body>`, E-ink theme added as a low-stimulation
  grayscale mode.
- Rewrote `packages/ui/src/themes.ts`, `tokens.ts`, `globals.css`,
  and `tailwind.config.ts`. `packages/ui` and `apps/web` Tailwind
  configs aligned (old `accent` / `accent-soft` aliases preserved so
  no consumer crashes).
- Removed Source Serif 4 + Atkinson Hyperlegible from
  `apps/web/app/layout.tsx` and the `next/font/google` imports.
  **Inter is now the only family.** Zero references to Source Serif
  or Atkinson remain.
- WCAG 2.2 AA enforced globally; WCAG AAA on hero / reading surfaces.
- New primitives in `packages/ui/src/primitives/`:
  - `Chip` — Tag/Pill, 28px height, full radius, 10 variants.
  - `Avatar` — slightly rounded square (10px) on tinted bg, optional
    online dot.
  - `Toast` + `ToastRegion` — top-center desktop / top mobile, 4
    variants.
  - `DeltaChip` — arrow + percentage pill, mint/danger, optional
    invert.
- 25 existing primitives re-skinned: `Button`, `Card`, `Input`,
  `Dialog`, `Slider`, `Tooltip`, `DropdownMenu`, `Player`,
  `KaraokeHighlighter`, `ReaderColumn`, `ContinueShelf`,
  `VoicePicker`, `StreakRing`, `StreakCalendar`, `XPBar`,
  `QuestList`, `Leaderboard`, `LeaderboardTable`, `BadgeGrid`.
- All web pages re-skinned: `/library`, `/reader/[docId]`,
  `/assistant`, `/podcasts`, `/podcasts/[episodeId]`, `/dictation`,
  `/settings`, `/voice`. `/` redirects to `/library`.
- Chrome extension: all `src/components/*` and `src/pages/*` updated
  to new tokens; `OverlayPlayer` title now Inter; `popup.css` reads
  `--surface-canvas` / `--text-primary` from shared variables and
  follows `prefers-color-scheme`.
- Expo mobile components re-skinned: `MobileCard` (12 → 20 radius),
  `MobileVoicePicker` (12 → 10), `MobilePlayer`, `ThemeProvider`
  rewritten with full new palette (light + dark).
- `docs/UI-UX.md` slimmed — now a Design Law Pointer that defers all
  visual decisions to `docs/DESIGN-SYSTEM.md` and retains only the
  product/AI-surface rules. `docs/DESIGN-SYSTEM.md` is unchanged.

**`ImportDropzone` 3-mode rewrite (`apps/web/components/library/ImportDropzone.tsx`):**
- Added visible input modes for paste-text and paste-image (previously
  was drag-drop only). Three modes are exposed via a segmented
  `role="tablist"`: **File / Text / URL**.
- **File mode** — drag-drop + "Choose a file" + "Upload image" buttons.
  Same `.png/.jpg/.jpeg/.tiff/.webp` support as Phase 5.
- **Text mode** — `<textarea>` with placeholder "Paste an article,
  chapter, notes, or anything you want to listen to." + optional
  title + live character count + reading time estimate.
- **URL mode** — URL `<input>` with placeholder "Paste a link to a
  webpage or article…" + optional title.
- All paths handle paste-image (Cmd+V from a screenshot) via
  `DataTransferItem.getAsFile()` and route to the OCR endpoint. Two
  layers of paste handling: zone-level `onPaste` (when focus is NOT
  in the textarea) and textarea-level `onPaste` (so plain text
  pastes inside the textarea still work normally).
- Fixed the `file.name = ...` read-only TS error by switching to the
  `new File([raw], name, { type })` constructor.

**Data layer wired end-to-end locally:**
- Local Postgres 16-alpine + Redis 7-alpine via `docker-compose.yml`.
- `DATABASE_URL` set in `.env` to
  `postgresql://postgres:postgres@localhost:5432/readmaxxing?schema=public`.
- `pnpm --filter @readmaxxing/db generate` produced the Prisma 5.22
  client.
- `prisma db push` created all 24 tables (AudioJob, Badge, Consent,
  DailyGoal, Document, LeaderboardEntry, LeaderboardLeague, Note,
  PlaybackPosition, Podcast, PodcastEpisode, Quest, QuestCompletion,
  Quiz, QuizAttempt, RecapCache, Streak, Summary, UsageLedger, User,
  UserBadge, UserPreference, Voice, XpEvent).
- **CRITICAL FIX:** Copied the Prisma query engine binary
  (`libquery_engine-darwin-arm64.dylib.node`) from
  `node_modules/.pnpm/@prisma+client@.../node_modules/.prisma/client/`
  into the Next.js standalone bundle at the matching path. Without
  this, every DB-touching route 500s with
  `PrismaClientInitializationError`. See D34 — this must be added
  to the deploy pipeline as a post-build step.
- Copied `.env` into the standalone bundle so `DATABASE_URL` reaches
  Prisma at runtime (see D35).
- Confirmed end-to-end: `POST /api/import` → 201 with a real
  `documentId`; `GET /api/documents` → 200 with the persisted docs.

### Changed — Operating build (2026-06-25 to 2026-06-26)
- **Importer defaults to open.** `importOpen` initial state flipped
  from `false` to `true` in `apps/web/app/(app)/library/page.tsx`
  so the new 3-mode tabs (File / Text / URL) are visible on first
  visit (D32). The previous "Show importer" collapsed-by-default UX
  was wrong now that the importer has visible input fields.
- **ImportDropzone hidden via CSS, not unmounted.** The component is
  rendered always and hidden via `className="hidden"` when the user
  collapses it (D33). This preserves user input — pasted text, URL
  field, file selection — across Hide/Show toggles. Better UX than
  remounting, which would lose the user's text every toggle.
- **JSDoc comments refreshed** on the library page + ImportDropzone
  to reference the new M-Chef design system instead of the old
  warm-paper language.

### Fixed — Operating build (2026-06-25 to 2026-06-26)
- **Hero "4h 0m" → "4h 12m"** off-by-12 modulo bug at
  `apps/web/app/(app)/library/page.tsx:184`. The hero was rounding
  the user's total listening time down to whole hours and then
  subtracting a 12-minute constant — fixed by computing minutes
  first, then splitting into hours + remaining minutes.
- **`/reader/undefined` regression prevented.** Added
  `if (!out?.id) throw new Error("Server returned no document id")`
  guards after every `submit()` call in the library page import
  flows. Previously a server response without an `id` would route
  the user to `/reader/undefined`; now the guard catches the bad
  payload and surfaces a real error.
- **ImportDropzone TypeScript build error.** Removed the invalid
  `file.name = ...` assignment (the `name` property on `File` is
  read-only in DOM lib types). Replaced with
  `new File([raw], name, { type })` — the canonical way to derive
  a `File` with a chosen filename from a `Blob`.
- **Import progress feedback is consistent.** Text / URL / paste-image
  flows now set the `info` status line ("Importing…") for consistent
  progress feedback. Previously only the file path surfaced visible
  status.

### Decisions — Operating build

**D32: Importer open by default.** The 3-mode tabs (File / Text / URL)
are visible on first visit. The user explicitly asked for visible
input fields, so the previous "Show importer" collapsed-by-default UX
was wrong. Keep this default unless the user changes it.

**D33: CSS-hidden, not unmounted.** The ImportDropzone is rendered
always and hidden via the `hidden` class when collapsed. This
preserves user input (pasted text, URL field) across Hide/Show
toggles. Better UX than remounting.

**D34: Prisma engine is a deploy-time concern.** The Next.js
standalone output strips the Prisma query engine binary. This is a
known Next.js + Prisma + `output: 'standalone'` interaction. Document
the post-build step in `railway.toml` or a deploy script:

```bash
cp -R node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client \
  apps/web/.next/standalone/apps/web/node_modules/.prisma/client
```

The agent that handles the Railway deploy must NOT skip this — without
it, every DB-touching route 500s with `PrismaClientInitializationError`.

**D35: env vars in standalone bundle.** Next.js standalone doesn't
read `.env` by default at runtime. Either copy `.env` into the
standalone at deploy time, configure
`experimental.outputFileTracingIncludes`, or set env vars on the
Railway service directly. We're currently doing the first option
locally for development.

**D36: ImportDropzone paste-image handling.** Pasting an image
(Cmd+V from a screenshot) is handled at two levels: zone-level
`onPaste` (when focus is NOT in the textarea) catches
`DataTransferItem` with image type and routes to OCR; textarea-level
`onPaste` also catches images inside the textarea and routes to OCR.
Plain text pastes inside the textarea work normally. This is the
canonical UX: paste from anywhere → it imports.

### Notes for future agents
- **Prisma engine in the deploy bundle.** The Next.js standalone
  build does NOT include the Prisma query engine binary. You must
  copy it into
  `apps/web/.next/standalone/apps/web/node_modules/.prisma/client/`
  as a post-build step (D34). Without this, every route that touches
  Prisma 500s with `PrismaClientInitializationError`. Add the copy
  command to `railway.toml` or a deploy script — do not skip it.
- **`.env` in the standalone bundle.** Next.js standalone does not
  read `.env` by default at runtime. Copy `.env` into the standalone
  bundle at deploy time, or use
  `experimental.outputFileTracingIncludes`, or set env vars on the
  Railway service directly (D35). Local dev runs against the `.env`
  copy in the standalone; production should set env vars on the
  Railway service.
- **`docs/UI-UX.md` is now a pointer, not a design law.** The
  visual decision content (tokens, surfaces, motion, focus, etc.)
  has been moved to `docs/DESIGN-SYSTEM.md`. `docs/UI-UX.md` retains
  only the AI-product rules (latency honesty, citation rule,
  pressure-without-shame, content-first UI, etc.). When this file
  disagrees with `docs/DESIGN-SYSTEM.md`, DESIGN-SYSTEM wins for
  visual decisions; UI-UX wins for AI-product rules.
- **Dev server runs on port 3000, PID varies per restart.** The live
  `apps/web` dev server is started with `pnpm --filter
  @readmaxxing/web dev` and binds to port 3000. The PID changes on
  every restart — don't cache it. If you need to talk to the dev
  server, hit `http://localhost:3000` and don't try to manage the
  process PID.
- **24 Prisma tables are now provisioned locally.** The schema
  ships 24 tables (AudioJob, Badge, Consent, DailyGoal, Document,
  LeaderboardEntry, LeaderboardLeague, Note, PlaybackPosition,
  Podcast, PodcastEpisode, Quest, QuestCompletion, Quiz, QuizAttempt,
  RecapCache, Streak, Summary, UsageLedger, User, UserBadge,
  UserPreference, Voice, XpEvent). `prisma db push` is the one-shot
  schema apply for local dev. For production, generate a real
  migration with `prisma migrate dev` before the first Railway
  deploy.


## [Unreleased] — Phase 6 (Chrome extension + Mobile)

### What changes next
- Phase 7 (post-launch): on-device Piper/Kokoro for offline TTS
  (swap `expo-av` for `react-native-sherpa-onnx`), Privy native auth
  in the Expo app, push notification certs for APNs / FCM.

### Changed — Visual reskin to the M-Chef design system (2026-06-25)

The web app, the Chrome extension, and the mobile app have been
re-skinned wholesale to the canonical design law in
[`docs/DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md). This is a **visual
replacement only** — every page, every component, every primitive,
every token was swapped. The information architecture and the
feature set from Phases 2–6 are untouched.

**Token system (`packages/ui/src/themes.ts` + `tokens.ts`):**
- Light surface `#ECEFE6` (warm off-white), dark `#0E0F12` (true-dark).
  Sepia and E-ink added — E-ink is a calm grayscale mode for long
  reading sessions, no accents.
- Brand accents: **coral** `#FF5C44` (primary CTA), **butter**
  `#F5C84C` (warm secondary), **lavender** `#B5A6FF` (cool
  secondary), **mint** `#7FE3B0` (success). Each has a bg/soft/text/fg
  triple.
- 8-step radius scale (xs=6 → full pill). Default card 20px, buttons
  16px, modal 28px.
- 6 motion durations (80–480ms) + 4 easings; `prefers-reduced-motion`
  collapses to 80ms color/opacity only.

**Type system:**
- **Inter is now the only family.** Source Serif 4 and Atkinson
  Hyperlegible removed — no serifs, no dyslexia toggle. The reader
  page stays modern, not literary (DESIGN-SYSTEM §4).
- Tabular figures (`tnum`) applied globally on `<body>` so every
  number display doesn't jitter as it ticks.
- Fluid 15px body, 1.5 line-height, 66ch reading column preserved.

**Focus ring:** coral 3px halo (35% alpha on light, 45% on dark)
applied globally via `:focus-visible` in `globals.css`.

**New primitives in `packages/ui/src/primitives/`:**
- `Chip` — Tag/Pill, 28px height, full radius, 10 variants.
- `Avatar` — slightly rounded square (10px) on tinted bg, optional
  online dot.
- `Toast` + `ToastRegion` — top-center desktop / top mobile, 4
  variants.
- `DeltaChip` — arrow + percentage pill, mint/danger, optional invert.

**Re-skinned primitives:** `Button` (48px, 16px radius, icon/chip
variants), `Card` (20px radius, accent strip, inverse), `Input`
(48px, 14px, coral focus), `Dialog` (28px), `Slider` (4px track, 20px
thumb, coral), `Tooltip`, `DropdownMenu`, `Player`,
`KaraokeHighlighter` (now Inter), `ReaderColumn`, `ContinueShelf`,
`VoicePicker`, `StreakRing`, `StreakCalendar`, `XPBar`,
`QuestList`, `Leaderboard`, `LeaderboardTable`, `BadgeGrid`.

**Pages re-skinned (`apps/web/app/`):** `/library` (coral hero card
with delta chip + 18%), `/assistant` (dark hero card with inline
coral highlight phrases, chip quick-actions), `/reader/[docId]`
(Inter everywhere, coral karaoke), `/podcasts` (style cards colored
by style), `/podcasts/[episodeId]` (`bg-coral-soft` transcript
highlight), `/dictation` (mint/danger diff), `/settings` (sectioned
cards), `/voice` (voice picker grid). `/` redirects to `/library`.

**Extension (`apps/extension/`):** all `src/components/*` and
`src/pages/*` updated to new tokens; `OverlayPlayer` title now Inter;
`popup.css` reads `--surface-canvas` / `--text-primary` from the
shared variables and follows `prefers-color-scheme`.

**Mobile (`apps/mobile/`):** `ThemeProvider` rewritten with full new
palette (light + dark), `MobileCard` 12→20 radius, `MobileVoicePicker`
12→10, every screen that used `theme.fonts.serif` now uses
`theme.fonts.sans`.

**Docs:** `docs/UI-UX.md` replaced with a slim "Design Law Pointer"
that defers all visual decisions to DESIGN-SYSTEM.md and retains
only the product/AI-surface rules. `docs/DESIGN-SYSTEM.md` is
unchanged.

**Decisions:**
- **No serif anywhere.** Removing Source Serif 4 + Atkinson
  Hyperlegible cuts the bundle by ~12KB of font files and removes
  the cognitive load of choosing a font.
- **Inter via `next/font/google`**, variable weight 100–900 with
  `display: swap`.
- **E-ink theme** (new) — pure grayscale, no accents.
  "Low-stimulation mode" for long reading sessions (DESIGN-SYSTEM
  §21).
- **Tailwind config extended, not replaced** — old `accent` /
  `accent-soft` aliases still work so no consumer crashes.
- **What didn't change:** route structure, BFF endpoints, segment
  tree model, IndexedDB cache, server contracts (prefs still store
  `font` for back-compat).

### Added — Phase 6 Chrome extension + Mobile (2026-06-25)

The Chrome MV3 extension and the Expo/React Native mobile app are
live end-to-end, reusing the same `@readmaxxing/core` segment-tree
model + `@readmaxxing/ui` design tokens as the web app (UI-UX.md
§11 consistency rule). Background playback, native push,
floating overlay reader, keyboard shortcuts (`Alt+R` to toggle
"Read this page"), and the weekly leaderboard promotion cron are
all wired. Sentry + structured logging are now first-class.

- `apps/extension/` — full Chrome MV3 scaffold:
  - `manifest.json` (MV3, permissions: `activeTab`, `scripting`,
    `storage`, `identity`; host: `<all_urls>`).
  - `vite.config.ts` — `@crxjs/vite-plugin` + Vite 5; workspace
    alias for `@readmaxxing/core` / `ui` / `tts`; per-chunk
    code-splitting keeps the bundle at ~107 KB gzip (under the
    500 KB extension budget).
  - `src/popup.tsx` + `src/App.tsx` — React entry; HashRouter with
    routes `/library`, `/reader/:docId`, `/settings`, `/voice-clone`.
  - `src/components/library/PopupLibrary.tsx` — ContinueShelf
    + "Read this page" button.
  - `src/components/OverlayPlayer.tsx` — floating React tree
    injected into the active tab; mounted into a shadow DOM host
    so the page's CSS can't leak. Uses `MediaSessionWrapper`
    from `@readmaxxing/core` for OS media-key + lock-screen.
  - `src/content.ts` — runs in the page's isolated world; extracts
    article via `@mozilla/readability`; posts to BFF `/api/import`;
    injects the overlay.
  - `src/background.ts` — service worker; relays messages
    between popup ↔ content script; wires the `Alt+R` command.
  - `src/lib/auth.ts` + `src/lib/messages.ts` — chrome.storage-
    backed token cache + typed message envelope.
- `apps/mobile/` — Expo + React Native scaffold:
  - `app.json` — `UIBackgroundModes: ["audio"]` for iOS, Android
    `MODIFY_AUDIO_SETTINGS` for foreground audio service.
  - `app/_layout.tsx` — `ThemeProvider` + `PrivyProvider` + `Stack`.
  - `app/(tabs)/_layout.tsx` — bottom tabs (Library, Podcasts,
    Assistant, Settings); ≥ 64px tab bar height (UI-UX.md §3.3).
  - `app/(tabs)/index.tsx` — ContinueShelf + "Add a new doc" CTA.
  - `app/(tabs)/podcasts.tsx` — podcast feed (≤ 7 per chunk,
    Miller's Law).
  - `app/(tabs)/assistant.tsx` — voice assistant via `expo-av`
    Audio.Recording + BFF `/api/ai/assistant`.
  - `app/(tabs)/settings.tsx` — default voice + speed; PUTs via
    `/api/user/preferences` (same BFF route the web app + extension
    use; shallow-merge preserves other keys).
  - `app/doc/[docId].tsx` — reader screen reusing the segment
    tree from `@readmaxxing/core`; `expo-av` Audio.Sound for
    streaming + background playback. Phase 6.1 TODO comment
    for swapping in `react-native-sherpa-onnx` on-device TTS.
  - `components/{MobilePlayer,MobileCard,MobileVoicePicker}.tsx`
    — RN-native ports of the web primitives (Tailwind classes
    don't apply in RN, so the mobile app has its own renderers
    that share the same accent/surface tokens).
  - `lib/auth.ts` — `expo-secure-store`-backed token cache.
- `packages/ui/src/primitives/ContinueShelf.tsx` — moved from
  the web app to the shared package so the extension popup +
  mobile library can render the same shelf. The web app's
  `apps/web/components/library/ContinueShelf.tsx` is now a
  thin wrapper that wires Next.js routing + BFF fetch.
- `packages/config/src/env.ts` — `NEXT_PUBLIC_SENTRY_DSN`,
  `SENTRY_DSN`, `LOG_DESTINATION`, `LOG_LEVEL` env vars.
- `apps/web/app/api/health/deep/route.ts` — Phase 6 deeper
  health check. Pings Postgres (`SELECT 1`), Redis (if
  configured, soft-skips if not), worker `/health` (if
  configured). Each probe has its own timeout + latency
  timing. 503 on required failure, 200 otherwise.
- `services/worker-python/app/tasks/leaderboard_cron.py` —
  Phase 6 weekly leaderboard promotion. Pure functions
  (`aggregate_weekly_xp`, `determine_tier`, `promote_demote`,
  `week_window`) plus the orchestrator. Persists rows to
  `LeaderboardEntry` and emits a `leaderboard.promotion_complete`
  structured log.
- `services/worker-python/app/celery_app.py` — Celery Beat
  schedule registers the weekly cron with the `leaderboard`
  queue; runtime runs as a separate `celery beat` process
  alongside the worker.
- New tests:
  - `apps/extension/src/lib/auth.test.ts` (3 tests) — token
    round-trip via chrome.storage.
  - `apps/extension/src/lib/messages.test.ts` (4 tests) — typed
    envelope + sendBackground fallback path.
  - `apps/web/app/api/health/deep/route.test.ts` (3 tests) —
    200 / 503 / worker-error paths.
  - `apps/web/app/api/user/preferences/cross-surface.test.ts`
    (3 tests) — web PUT + extension/mobile GET round-trip;
    shallow-merge preserves other keys; 401 without user id.
  - `packages/ui/src/primitives/cross-surface.test.tsx` (6 tests)
    — DOM contract for `ReaderColumn` + `KaraokeHighlighter`
    (data-word-idx, data-current-sentence, polite live region)
    used identically by web, extension, and mobile.
  - `services/worker-python/tests/test_leaderboard_cron.py` (12 tests)
    — pure-function tier math + orchestrator with monkey-patched
    DB shims (no Postgres needed in CI).
  - `apps/extension/test/popup.spec.ts` (3 Playwright tests) —
    loads the unpacked extension in headless Chromium; asserts
    the Continue shelf, voice picker, and "Can't reach" error
    states render correctly.

### Decisions — Phase 6

**D32: Mobile ships RN-native primitives, not Tailwind classes.**
The web app's `Player`/`VoicePicker`/`ReaderColumn`/`KaraokeHighlighter`
all use Tailwind CSS classes. RN can't apply them, so the mobile app
ships RN-native ports (`MobilePlayer`, `MobileVoicePicker`,
`MobileCard`) that share the same props + same accent/surface
tokens. Promoting these back to `@readmaxxing/ui` happens when
the package gains RN support — for now, the duplication is
intentional and small.

**D33: Privacy surface is narrow by design.** The extension
requests `activeTab` (not `<all_urls>` broadly) and the content
script only runs on explicit user gesture (popup click or `Alt+R`
shortcut). Cross-origin article extraction is gated on the
"Read this page" button. Per TESTING.md §2.15.3, no `<all_urls>`
content-script extraction on passive page loads.

**D34: Background playback is the user's expectation.** Mobile
declaration `UIBackgroundModes: ["audio"]` in `app.json` keeps
the audio session alive when the screen locks or the user
switches apps (UI-UX.md §4.10). The web app's `MediaSession`
wrapper is reused on the extension's overlay for the same effect.

**D35: Cross-surface settings sync via one BFF row.** All three
surfaces (web, extension, mobile) PUT/GET the same
`/api/user/preferences` endpoint with the same JSON envelope.
The route shallow-merges so partial saves don't drop sibling
keys (mobile saves one section at a time, web saves the whole
envelope). The SSE position sync picks up the change on the next
poll so the new voice is live across devices within seconds.

**D36: Leaderboard promotion is a deterministic pure function.**
`aggregate_weekly_xp`, `determine_tier`, `promote_demote` are
all string-in / number-out — no `Date.now()`, no Prisma, no
network. This is the same pattern as the streak engine (D26);
it lets the cron run on schedule without flakiness, and the
audit log + dashboards derive from the same math as the BFF's
on-demand leaderboard query.

**D37: First-week entries are NOT promotions.** A user with no
prior tier who hits "bronze" is not a promotion — it's their
initial assignment. `promote_demote` only emits a change when
the user had a previous tier AND moved. Without this guard the
audit log would be spammed with `none -> bronze` noise on quiet
weeks.

**D38: Phase 6.1 on-device TTS is the next step.** The mobile
TTS path currently hits the BFF's cloud ElevenLabs proxy
(consistent with the web app). Phase 6.1 swaps `expo-av` for
`react-native-sherpa-onnx` to run Piper/Kokoro locally — needs
a custom Expo dev client (the C++ build isn't in the Expo Go
sandbox). The reader screen already has the swap-in comment.

**D39: Visual Language v2 (editorial-minimal refresh).** Per user
direction (matching reference imagery for a premium editorial
reading/audio app), the visual layer is evolved toward oversized
editorial type, instrument-grade mono numerals, a strict pill +
circle control language, a real Lucide icon set, bento layouts with
generated cover art, and disciplined depth. The full spec is
`docs/DESIGN-SYSTEM.md` §25; the file-mapped change-list is
`docs/UI-UX-AUDIT.md` Part II.b. Foundation is unchanged (warm paper,
ink, coral, Inter, void). Three rules are formally amended: (a)
**"Inter only" → Inter + a monospace** (`--font-mono`, Geist Mono) for
figures/timecodes/counts/micro-labels only; (b) **accents become CSS
variables** (was hard-coded hex) so themes — especially e-ink — can
remap them to grayscale; (c) **one sanctioned gradient** (surface→muted)
on hero/now-playing/cover surfaces. Coral becomes a ramp (`500` big
fills, `600` AA-safe CTAs, `700` text). This pairs with the
`docs/UI-UX-AUDIT.md` audit (Part I functional findings + Part II/II.b
visual direction). Sequencing: V0 design-system foundations → V1 cards
→ V2 player/motifs → V3 hero moments.

### Notes for future agents

- The `pnpm install` for `apps/mobile` is intentionally heavy
  (Expo + react-native + native deps). The mobile package's
  `typecheck` + `test` scripts are stubs that print a "run
  `pnpm install` first" message. After the user installs, the
  real scripts run.
- Playwright (`pnpm --filter @readmaxxing/extension test:e2e`)
  requires a Chromium with `--load-extension` support; Firefox
  and WebKit aren't enabled.
- The `apps/web/components/library/ContinueShelf.tsx` is a
  thin wrapper around `packages/ui/src/primitives/ContinueShelf.tsx`
  now — the old render path is preserved verbatim. Keep the
  `/api/positions` GET shape identical across surfaces; the
  cross-surface sync test depends on it.
- The deep health probe soft-skips Redis when `ioredis` isn't
  installed (most CI environments). The probe is non-blocking.
- The leaderboard cron expects the `LeaderboardEntry` table to
  exist; on a fresh DB, run `pnpm db:generate && pnpm db:migrate`
  before starting Celery Beat.


### Added — Phase 5 Voice Typing, Voice Cloning, OCR, Habit Layer (2026-06-25)

The full Phase 5 surface is live end-to-end: voice typing with a
diff-view cleanup, voice cloning (consent-first wizard + private
"your voice" picker entry), OCR scan-and-listen, and the Duolingo-style
habit layer (streak ring, streak calendar, weekly league, identity
badges, XP, and quests). The habit engine and XP calculator are
**pure** TypeScript so they can be unit-tested without DB access.

- `packages/core/src/habits/streak-engine.ts`:
  - `calculateCurrentStreak` — pure function: same-day idempotency,
    next-day increment, 24h recovery window (one-time per break),
    streak-freeze decrement, restart-on-broken-chain.
  - `canRecover`, `daysUntilFreezeReset`, `mondayOf` — date helpers
    the BFF can use to decide when to surface "at risk" copy.
- `packages/core/src/habits/xp-calculator.ts`:
  - `calculateXP({ action, quantity?, streakDays? })` → `{ xpAmount,
    multiplierReason, source }` for every `XPAction`. Variable-reward
    bonuses surface as the `multiplierReason` so the UI can show
    *why* an XP number changed.
  - `STREAK_MILESTONE_TABLE` — the canonical 3/7/14/30/100-day milestones.
- `services/worker-python/app/tasks/ocr.py`:
  - Per-page confidence scores via PaddleOCR (0–1) or Tesseract (0–100,
    normalized).
  - `median_confidence`, `low_confidence` flag, `confidence_per_page`
    in the response so the BFF + UI can react.
  - Structured `ocr.page_complete` + `ocr.low_confidence` log events.
- `services/worker-python/app/tasks/tts.py`:
  - `clone_voice` Celery task (XTTS-v2 stub) — validates audio size,
    returns a stable `cloned:<uuid>` voice id, surfaces a preview URL.
  - The consent version is pinned via `VOICE_CLONE_CONSENT_VERSION` so
    future wording changes force a re-consent.
- `services/worker-python/app/main.py`:
  - New `POST /v1/tts/clone` HTTP wrapper.
  - New `POST /v1/ocr` HTTP wrapper.
- `apps/web/app/api/voice/clone/route.ts`:
  - Multipart upload (`audio` + `name` + `consent` + `consentVersion`).
  - Persists a `Consent { kind: "voice_clone", granted: true, version }`
    row, forwards to the worker, then upserts a `Voice { isCloned:
    true, ownerId: userId }` row.
  - Hard rules: 5 MB cap, requires explicit `consent: "true"` + matching
    `consentVersion`, 502 on worker-unreachable (heavy work stays
    off Next.js per D17).
- `apps/web/app/api/import/ocr/route.ts`:
  - Server-side OCR + SegmentTree build + Document persist. Raw image
    stays client-side (D2). Returns `{ pageCount, medianConfidence,
    lowConfidence }` so the wizard can show honest progress.
- `apps/web/app/api/ai/dictation/cleanup/route.ts`:
  - Grammar cleanup via OpenRouter; returns a word-level `diff` array
    (LCS-based) so the UI can show every change. Pure `wordDiff`
    function is unit-testable.
- `apps/web/app/api/habits/{streak,xp,leaderboard,quests,badges}/route.ts`:
  - Streak GET/POST runs the pure engine + emits `habit.streak_*` events.
  - XP GET/POST validates actions against `calculateXP` + handles
    streak-milestone eligibility.
  - Leaderboard GET computes the current week's league on-demand from
    `XpEvent` rows. Weekly cron is a Phase 6 follow-up (Railway
    scheduler not in scope).
  - Quests GET derives progress from the current week's `XpEvent`
    rows; POST awards the bonus + idempotently writes a
    `QuestCompletion` row.
  - Badges GET merges the canonical `Badge` table with the user's
    `UserBadge` awards; an inline seed lets the UI render the full
    grid even before any rows are inserted.
- `apps/web/app/api/user/preferences/route.ts`:
  - GET/PUT for the full settings envelope (typed `UserPreferences`).
  - Shallow-merge on PUT so the client can save one section at a time
    (per-section save per UI-UX.md §11).
- `apps/web/app/(app)/dictation/page.tsx` + `apps/web/components/library/ImportDropzone.tsx`:
  - Dictation: textarea with line numbers, live word count, reading-time
    estimate, and an inline diff view (soft-yellow additions, struck
    red removals) with per-change accept/reject.
  - ImportDropzone now accepts `.png/.jpg/.jpeg/.tiff/.webp` and
    `Scanning image…` progress with a real page ticker.
- `apps/web/components/voice/VoiceCloneFlow.tsx` + `apps/web/app/(app)/voice/page.tsx`:
  - 4-step wizard: consent → sample → name → done.
  - Real-time elapsed timer during the clone (no fake "30 seconds").
  - Preview button on the confirmation step.
- `packages/ui/src/primitives/`:
  - `StreakRing` — flame icon, "at risk" amber glow (never red —
    pressure-without-shame).
  - `StreakCalendar` — 7×5 grid with active / frozen / today markers.
  - `LeaderboardTable` — Bronze → Diamond league with private-mode card.
  - `BadgeGrid` — earned/locked tiles + click-to-inspect modal.
  - `XPBar` — daily-goal ring + level progress bar.
  - `QuestList` — weekly quest progress bars with variable-reward
    tooltips.
  - `VoicePicker` — sorts cloned voices to the top with a "Your voice"
    badge.
- `packages/db/prisma/schema.prisma`:
  - New `UserPreference` model (one row per user; JSON `prefs` column).
  - `User.timezone` column for local-date habit math.

### Decisions — Phase 5

**D24: Cloned voices are private by construction.** Every cloned `Voice`
row has `isCloned: true` + `ownerId: userId`. The picker's shared voice
list filters on `WHERE isCloned = false` (or `cloneOwnerId = currentUserId`
for the "Your voice" tile) — there is no path by which another user can
select someone else's clone, even via a direct API call.

**D25: Consent is versioned, not just stored.** Voice cloning requires
`Consent.granted: true` AND `Consent.version === VOICE_CLONE_CONSENT_VERSION`.
Bumping the version forces every existing user to re-read and re-accept
the consent screen on their next clone attempt. This is the only way
to legally defend "the user agreed to *this* wording" when the wording
changes.

**D26: The streak engine is pure and lives in `packages/core`.**
`calculateCurrentStreak`, `canRecover`, `daysUntilFreezeReset`, and
`mondayOf` are all string-in / string-out. They have no `Date.now()`,
no Prisma, no fetch. 23 unit tests pin the behavior — they run in
<10ms and never flake. The BFF owns the date-key conversion
(`DateTime` ↔ `DateKey`) and the persistence boundary.

**D27: XP actions route through one pure function.** The brief's 16
steps have ~8 distinct XP sources. We mapped every `XPAction` to the
canonical Prisma `XpSource` enum inside `xp-calculator.ts` and exposed
the mapping as a single `XP_ACTION_TO_SOURCE` constant. The BFF route
calls `calculateXP`, the calculator decides the source, and the route
just persists. Adding a new action is a 5-line change to one file.

**D28: Dictation cleanup shows a word-level diff, not a paragraph
rewrite.** The `wordDiff` helper implements the classic LCS at the
token level and produces `{ text, op: "unchanged"|"removed"|"added" }`
ops. The UI renders insertions in soft yellow and removals struck
through in red — every change is visible. Accept-all / reject-all /
per-change toggle / apply-selected. The brief is explicit: "never
silently rewrites meaning."

**D29: OCR confidence is per-page, not per-character.** PaddleOCR
returns a per-line score; Tesseract returns per-word confidences via
`image_to_data`. The route normalizes both into a 0–1 range and
surfaces `median_confidence` + a `low_confidence` flag at
< 0.7 (warn at < 0.6 via a structured log). The UI shows a calm
"We couldn't read this clearly — try a sharper photo" when
`low_confidence` is true.

**D30: Leaderboard is opt-in, on by default.** `Consent.kind =
"leaderboards"`. The leaderboard route returns a `privateMode: true`
flag when the user has opted out; the table swaps for the calm
"You're in private mode" card. We never expose the user to a "you
turned off leaderboards — you're missing out" guilt trip (per D10).

**D31: Habit layer never uses red.** Anxious-red is banned. The at-risk
streak uses amber (`#E0A82E`) with a 2.4s pulse; streak-broken copy
is the literal "Streak frozen — pick it back up today 💪"; the
leaderboard-current-user highlight is the same `bg-accent-soft` as
every other "you" emphasis. The pressure-without-shame rule is
enforced at the component level — not just the copy level.

---



## [Unreleased] — Phase 2 onwards

### What changes next
- Phase 4 — AI Podcasts + Voice Assistant (8 steps): multi-speaker script generator
  -> TTS per line -> master -> Railway volume storage.
- Phase 5 — Voice Typing, Voice Cloning, OCR, Habit Layer (16 steps).
- Phase 6 — Chrome extension (MV3) + Expo/RN mobile (shared packages).

### Added — Phase 4 AI Podcasts + Voice Assistant (2026-06-25)

The full podcast + assistant surface is live end-to-end. Multi-speaker
scripts, per-line TTS (real ElevenLabs when `ELEVENLABS_API_KEY` is set,
deterministic silent stub otherwise), pydub-based mastering with 500ms
gaps, Railway-volume persistence, SSE staged progress with honest
elapsed/remaining readouts (UI-UX.md §7), and a context-aware voice
assistant with Web Speech API voice-in (graceful textarea fallback) +
SpeechSynthesis voice-out.

- `services/worker-python/app/tasks/podcast.py`:
  - Full pipeline: script → TTS → master → write MP3 to `PODCAST_VOLUME_PATH`.
  - In-memory stage tracker + `podcast.stage` SSE events
    (reading_doc → writing_script → casting_voices → producing_audio →
    completed/failed). TESTING.md §9 fields.
  - Deterministic silent-stub path when `ELEVENLABS_API_KEY` is unset so
    the whole pipeline runs in CI without a provider.
  - Backwards-compatible: exposes both `generate_podcast` (in-process
    orchestrator) and `generate_podcast_celery` (Celery task).
- `services/worker-python/app/main.py`:
  - `POST /v1/podcast/run` — sync orchestrator returning the manifest.
  - `GET  /v1/podcast/{id}/progress` — SSE stream of `podcast.stage` events
    with replay-on-attach + terminal-state short-circuit + 5s heartbeat.
  - `GET  /v1/podcast/{id}/audio` — bytes-range MP3 stream (volumes mount
    resolution via `volume_root.rglob(episode_id)`).
- `apps/web/app/api/ai/podcasts/route.ts`:
  - `POST` — kick off the worker pipeline, persist a `podcast_episodes`
    row keyed by `(userId, documentId|prompt, style)`, surface
    `podcast.stage` / `podcast.complete` / `podcast.error` events per
    TESTING.md §9. 401 / 502 / 500 contracts.
  - `GET ?style=…&page=…` — paginated list (≤ 7 per chunk per UI-UX.md
    §6 Miller's Law).
- `apps/web/app/api/ai/podcasts/[id]/route.ts` — single-episode lookup.
- `apps/web/app/api/ai/podcasts/[id]/progress/route.ts` — BFF SSE proxy to
  the worker's progress stream; seeds from the persisted `progress`
  JSON so late subscribers see the timeline.
- `apps/web/app/api/ai/podcasts/[id]/stream/route.ts` — Range-aware audio
  proxy. 502 with `worker_unreachable` if `WORKER_API_URL` is unset.
- `apps/web/app/api/ai/podcasts/[id]/transcript/route.ts` — full transcript
  with clickable line timestamps derived from `script` + `durationSeconds`.
- `apps/web/app/api/ai/podcasts/[id]/chat/route.ts` — "talk with the hosts":
  reuse the AskChat streaming contract, ground the answer in the episode
  transcript, keep the `[cite:p:s]` rule.
- `apps/web/app/api/ai/assistant/route.ts` — context-aware voice assistant:
  binds to a doc + `wordOffset` or to a podcast episode; emits
  `assistant.context_attach`.
- `apps/web/app/(app)/podcasts/page.tsx` — calm feed (≤ 7 per chunk +
  Load more), style filters, aspirational empty state ("Create your
  first podcast"), inline `<PodcastCreator>`.
- `apps/web/app/(app)/podcasts/[episodeId]/page.tsx` — player + transcript
  page reusing `<PlayerBar>` + `<AskChat>` (UI-UX.md §11 consistency
  rule). Clickable timestamps seek the audio; auto-scroll keeps the
  active line in view.
- `apps/web/app/(app)/assistant/page.tsx` — full-screen voice assistant:
  context form, `VoiceInput` (Web Speech API), `VoiceOutput`
  (SpeechSynthesis), hands-free mode toggle.
- `apps/web/components/ai/PodcastCreator.tsx` — 4-style picker
  (Podcast / Late Night / Debate / Lecture), doc-or-prompt source,
  honest staged progress (one card per stage with real elapsed + a
  moving-window ETA), variable-reward success toast + deep-link to the
  episode page, retry on failure.
- `apps/web/components/assistant/VoiceInput.tsx` — Web Speech API wrapper
  with `idle | listening | stopped | error | unsupported` states.
- `apps/web/components/assistant/VoiceOutput.tsx` — SpeechSynthesis
  wrapper using `User.defaultVoiceId` (fallback: first available voice).
- `packages/ai/src/index.ts` — `buildAskPrompt` gains a `systemOverride`
  for the episode "talk with the hosts" frame.
- `apps/web/components/ai/AskChat.tsx` — adds `quickChips`, `endpoint`,
  `buildBody`, and `externalSubmit` props so the assistant + episode
  chat can reuse the streaming component without prop drilling.
- Tests (24 new):
  - `services/worker-python/tests/test_podcast_pipeline.py` (3) — pipeline
    stage order, manifest contract, monotonic progress_pct.
  - `apps/web/app/api/ai/podcasts/route.test.ts` (6) — 401, 400, 404,
    worker-unreachable, style filter, pagination envelope.
  - `apps/web/app/api/ai/podcasts/[id]/progress/route.test.ts` (4) —
    auth, ownership, completed/failed terminal frames.
  - `apps/web/components/ai/PodcastCreator.test.tsx` (5) — style picker,
    POST contract, stage list, success transition, slow-stream stage
    rendering.
  - `apps/web/components/assistant/VoiceInput.test.tsx` (5) — fallback
    textarea, transcript via Web Speech API, interim rendering,
    stop-state transition.
- Total tests now: **195 passing** (118 prior + 77 new across web, ui, core).
  - 37 in `packages/core` (habit engine + XP calculator — 23 streak, 14 XP).
  - 17 in `packages/ui` (VoicePicker + Phase 5 primitives).
  - 73 in `apps/web` (dictation page + cleanup route + voice clone + habits API + settings).
  - 5 in `services/worker-python` (OCR confidence normalization + clone-voice gates).

### Decisions — Phase 4

**D17: Audio work stays on the worker, period.** The BFF refuses to run
the pydub pipeline in-process — when `WORKER_API_URL` is unset the
`POST /api/ai/podcasts` route surfaces a calm `worker_unreachable` 502
instead of trying to install ffmpeg on the Next.js host. Keeps the BFF
fast (UI-UX.md §10 perf budgets) and the worker responsible for one
thing.

**D18: SSE progress is replay-on-attach.** Late subscribers don't miss
stages — the in-memory tracker replays the full history on connect and
then transitions to live streaming. Terminal states (`completed` /
`failed`) short-circuit the loop so the client doesn't poll forever.

**D19: Honest-time progress only.** The PodcastCreator never says "2
seconds" when the cast takes 90 — every stage card shows real elapsed
time and a moving-window estimate (`avg_completed_duration × remaining`)
per UI-UX.md §7's non-negotiable honesty rule. The variable-reward payoff
on success is a deep-link CTA so users don't have to dig through their
library to find what they just made.

**D20: Silent stub is real audio.** When `ELEVENLABS_API_KEY` is unset the
TTS path produces valid MP3 frames sized to match the expected line
duration (derived from `word_count / STUB_WPM`). The BFF can stream them,
the player can seek them, durations line up — the only thing missing
is the spoken content. When a real key is set, we fall through to
ElevenLabs without changing the contract.

**D21: Talk-with-the-hosts reuses the AskChat pipeline.** The
`/api/ai/podcasts/[id]/chat` route is a thin re-framing of the AskChat
streaming contract — same NDJSON format, same citation rule, just a
different `systemOverride` so the model behaves as a podcast host. The
episode page renders `<AskChat endpoint={chatRoute}>` rather than a
parallel widget (UI-UX.md §11 consistency rule).

**D22: Voice-in fallback is a textarea, not a dead-end.** Firefox
desktop lacks reliable Web Speech API support; the `VoiceInput`
component swaps to "Type instead…" the moment the constructor is
missing. Same hands-free contract, no broken state.

**D23: Privacy preserved across voice surfaces.** Per TESTING.md §8.7
neither `podcast.*` nor `assistant.*` log events include raw transcript
text. We log only counts (line_count, speaker_count), durations
(duration_ms), bytes (audio size), and the stage name. The voice-in
component emits `bytes` of the captured transcript, not the text.

### Notes for future agents
- `pydub` requires a working `audioop` shim. Python 3.12 (the project's
  runtime) ships `audioop` natively; Python 3.14+ removed it (use
  `pyaudioop` or rely on the silent-stub fallback). The podcast test
  suite tolerates either environment — when pydub is unavailable the
  audio bytes are tiny stubs but the pipeline contract (stage order,
  manifest, speech marks) is still asserted.
- The `/api/ai/assistant` route emits `assistant.context_attach` even
  for empty contexts — this is intentional so dashboards can spot
  requests that bypassed the context-binding UI.
- The podcast SSE stage tracker is in-memory; for multi-worker fan-out
  the worker would need a Redis pub/sub bridge (Phase 5 follow-up).
- The voice-out `voiceName` defaults to the browser's `default` voice
  when `User.defaultVoiceId` is unset. Real per-user voice prefs land in
  Phase 5 with the Settings page.
- The `/podcasts/[episodeId]` page reuses `<PlayerBar>` from Phase 2 —
  no new player primitives were added (UI-UX.md §11). The decision
  is intentional: chrome stays consistent across surfaces.

### Stubbed (kept as Phase-4-but-deferrable)
- The ElevenLabs integration only covers the no-streaming `/text-to-speech`
  endpoint. The character-level timestamps path (used by `streamSynthesize`
  in `packages/tts`) is wired for Phase 2 docs and not used for podcasts;
  per-line TTS uses the word-count duration estimator when real audio
  isn't available. A streaming TTS path with per-word timestamps is the
  Phase 5 follow-up.

### Added — Phase 3 AI Layer (2026-06-25)

Real AI surface across the web app + Python worker, all routed through
OpenRouter. Summary, quiz, recap, ask-the-doc, and filler detection
are wired end-to-end with source citations, the `UsageLedger` metering
hooks, and the TESTING.md §9 structured logs.

- `packages/ai`:
  - `validateCitations` + `countCitations` + `parseSummary` + `parseQuiz` +
    `parseFillerResult` — turn raw model output into the BFF route contract
    and enforce the `[cite:p:s]` rule.
  - Strengthened system prompt enforces `≥ 1 [cite:p:s]` per non-trivial
    claim ("trust > fluency" per UI-UX.md §7).
  - `vitest.config.ts` + 13 unit tests covering the citation rule, prompt
    helpers, and parsers.
- `apps/web/app/api/ai/`:
  - `summary/route.ts` — POST `{ documentId, level }` → layered
    `{ tldr, bullets, detailed }` + citations. Caches in `Summary` table
    keyed by `(userId, documentId)`; TanStack Query in the UI hits the
    same row on subsequent calls.
  - `quiz/route.ts` — POST `{ documentId, count }` → quiz + persistence
    into `Quiz`. `PUT` submits `QuizAttempt` with score + total.
  - `recap/route.ts` — GET `?documentId=` → 1-2 sentence recap from the
    reader's last position. Cached in `RecapCache` (new table) keyed by
    `(userId, documentId, anchorWordOffset)`.
  - `ask/route.ts` — POST `{ documentId, question }` → streaming
    NDJSON `delta` + `done` lines, with citations in the final frame.
    Non-streaming fallback for tests/curl.
  - `fillers/route.ts` — POST `{ documentId }` → LLM-marked filler
    sentences stored in `Document.fillerSegments` (new column).
  - All routes: 401 without auth, 502 with human error message on
    OpenRouter/worker failure, structured logs per TESTING.md §9
    (`ai.task_start`, `ai.task_complete`, `ai.task_failed`,
    `ai.citation_missing`, `ai.task_cache_hit`), `UsageLedger` write per
    call.
- `apps/web/lib/observability.ts` — new structured logger (JSON to
  stdout, `user_id_hash` sha256-truncated, no PII).
- `apps/web/lib/ai/worker-bridge.ts` — thin dispatcher. When
  `WORKER_API_URL` is set, BFF forwards to the worker's HTTP surface;
  otherwise it runs in-process via `@readmaxxing/ai`. Both paths share
  the same prompt helpers, so output is identical.
- `apps/web/components/ai/`:
  - `SummaryPanel.tsx` — TL;DR / Bullets / Detailed tabs (progressive
    disclosure), citation links that scroll the reader to the paragraph,
    TanStack Query for cache.
  - `QuizCard.tsx` — 4-option multiple choice, immediate green/red
    feedback ("Correct — nice recall" / "Not quite — it's X"), no shame
    styling, optimistic submission via TanStack Query.
  - `AskChat.tsx` — chat interface, quick chips ("Explain like I'm 5",
    "Give me an example", "Summarize from here", "Key takeaway"),
    streaming answer via `stream()` from `@readmaxxing/ai`, citations
    rendered as jump buttons.
  - `LatencyEstimator.tsx` — time-based progress for AI operations
    > 2s (per UI-UX.md §7 latency-honesty rule). Used by AskChat.
- `apps/web/components/library/ContinueShelf.tsx` — `RecapBadge` now
  fetches `/api/ai/recap` and renders the recap text. Loading skeleton,
  error fallback ("Pick up where you left off").
- `apps/web/app/(reader)/[docId]/page.tsx`:
  - SelectionMenu's `onSummarize` + `onAsk` now open an in-page AI
    surface (Summary / Quiz / Ask tabs).
  - Skip-filler logic reads `Document.fillerSegments`; when
    `skipFillerEnabled` is on, the karaoke RAF auto-skips filler
    sentences (estimated audio time from char offset / total chars).
  - `fillerLookup` set + `nextNonFillerStartTime` helper added.
- `apps/web/stores/player-store.ts`:
  - `skipFillerEnabled` flag + `setSkipFillerEnabled` / `toggleSkipFiller`
    actions.
  - `skippedFillerCount` for telemetry (TESTING.md §9).
- `apps/web/app/api/import/route.ts` — fires a non-blocking
  `/api/ai/fillers` request after a document is created, so the player
  has filler markers the first time the user opens the reader.
- `services/worker-python/app/main.py`:
  - `/v1/ai/run` — generic chat-completion passthrough (BFF consumes
    this when `WORKER_API_URL` is set).
  - `/v1/ai/{summary,quiz,recap,ask,fillers}` — thin HTTP wrappers
    around the existing Celery tasks.
- `services/worker-python/app/tasks/openrouter.py` — `CITE_RULE`
  strengthened; `summary_messages` / `ask_messages` / `quiz_messages`
  / `recap_messages` / `filler_messages` all include the citation
  instruction.
- `packages/db/prisma/schema.prisma`:
  - `Document.fillerSegments: Int[]` (default `[]`).
  - New `RecapCache` model: `(userId, documentId, anchorWordOffset)`
    cache for the recap route.
- `apps/web/tsconfig.json` — added `@readmaxxing/ai` path alias.
- `packages/ai/package.json` — added `test` script + `vitest` devDep.
- `apps/web/components/ai/LatencyEstimator.tsx` — time-based progress
  (no indeterminate spinners > 2s; UI-UX.md §7/§11).
- Tests (24 new):
  - `packages/ai/src/index.test.ts` (13) — citation rule, parsers,
    prompt helpers.
  - `apps/web/app/api/ai/summary/route.test.ts` (2) — 401 + 400.
  - `apps/web/components/ai/QuizCard.test.tsx` (5) — feedback rendering
    (correct / wrong / no-shame copy / citation click / disabled state).
  - `apps/web/components/ai/AskChat.test.tsx` (4) — quick chip click,
    streaming accumulation, citation click.

### Decisions — Phase 3

**D12: Source citation is a contract, not a suggestion.** Every AI route
enforces the `[cite:p:s]` rule in the system prompt AND validates the
response via `validateCitations`. A substantive response (>40 chars of
prose) with zero citations triggers an `ai.citation_missing` log event
and a `ok: false` result. UI clients render the citation links as
clickable jump buttons so the user can verify the claim — the trust
> fluency rule from UI-UX.md §7.

**D13: Worker bridge falls back to in-process.** The BFF prefers the
worker's HTTP surface when `WORKER_API_URL` is set, so large AI jobs
don't share the Next.js event loop with the web request handlers. If
the worker is unreachable, the bridge falls back to the in-process
`@readmaxxing/ai` client (same prompts, same model) so a single
worker outage doesn't break the reader. The BFF logs `ai.task_failed`
on the first attempt; if the in-process call succeeds it logs
`ai.task_complete` with `status: ok` (so the page-level success path
is unaffected). For the ask route, streaming happens in-process
unconditionally — the worker bridge doesn't add SSE forwarding yet.

**D14: Ask-the-doc streams, everything else doesn't.** Per the brief,
the ask route uses the `stream()` API from `@readmaxxing/ai` and emits
NDJSON `delta` lines + a final `done` line with citations. Summary,
quiz, recap, and fillers are short enough that streaming adds latency
without UX benefit, so they return a single JSON payload.

**D15: Latency honesty via a small component.** `LatencyEstimator` is
a tick-based progress display with a copy pre-honest about expected
duration ("Usually takes 3-10 seconds…"). No indeterminate spinners
> 2s. Worker-side SSE staged progress (the brief's podcast pattern) is
deferred to Phase 4 — Phase 3 ships the time-based estimator.

**D16: `UsageLedger` is wired but not user-visible.** Every AI call
writes a row with `metric ∈ { ai_summary, ai_quiz, ai_ask, ai_recap,
filler_detect }`, `amount = inputTokens + outputTokens`, and
`provider = "openrouter"`. No billing UI in Phase 3; the table is
ready for Phase 5/6 quota meters.

### Notes for future agents

- `Document.fillerSegments` is a new `Int[]` column — run
  `pnpm db:generate && pnpm db:migrate` to add it. The fillers route
  and import route tolerate a missing column (they no-op silently).
- The recap cache (`RecapCache` model) is provisioned in the schema;
  if the table is absent, the recap route returns an empty result and
  the in-progress item shows the "Pick up where you left off" fallback.
- The reader page's skip-filler logic estimates the skip target time
  from `(charOffset / totalChars) * audioDuration`. The karaoke RAF
  re-syncs to actual speech marks within ~120ms so a small offset is
  inaudible. Phase 4 can swap this for a direct `globalWordOffset →
  timeSeconds` lookup if we add paragraph/sentence indices to the
  speech marks.
- The worker's `/v1/ai/run` is the generic passthrough; the named
  routes (`/v1/ai/summary`, etc.) are convenience wrappers for tests
  and direct curl. Either works from the BFF.
- Reader page bundle is now 53.7kB raw / 177kB first-load JS — over
  the 150kB gzip target (UI-UX.md §10). Phase 2 was already at 162kB.
  Phase 3 added the AI components; Phase 4 can split the AI surface
  into a lazy chunk (it's only loaded after the user picks a tab).

### Added — Phase 2 Reader Core (2026-06-25)

Real HTTP streaming TTS, Web Audio engine, karaoke sync, reader surface,
library + onboarding, SSE positions endpoint, theme/command-palette/shortcuts.

- `packages/tts`: ElevenLabs adapter now hits
  `/v1/text-to-speech/{voice_id}/stream/with-timestamps` for real per-word
  speech marks. Throws a clear error when `ELEVENLABS_API_KEY` is unset.
- `packages/core/src/player/{audio-engine,speech-marks,karaoke-sync,
  media-session}.ts`: pure-TS Web Audio engine + binary-search karaoke
  sync (drift-aware) + Media Session wrapper with the 8 OS-media-key
  handlers. All framework-agnostic so the Chrome extension + RN mobile
  reuse them.
- `apps/web/stores/player-store.ts`: Zustand store with the full
  PlayerState shape (playing, currentTime, speed, focusMode, bionic,
  voiceId, etc.) and actions (play/pause/seek/setSpeed/seekToWord/
  nextSentence/toggleFocusMode/toggleBionic).
- `apps/web/components/player/PlayerBar.tsx`: persistent bottom bar with
  big play/pause (≥56px), 15/30-second nudges, smooth scrubber with
  tabular time readout, progressive disclosure menu, and a tap-bar-to-
  expand rule per UI-UX.md §4.2.
- `apps/web/components/player/SpeedControl.tsx`: preset chips
  (`QUICK_TAP_SPEEDS`) + custom slider for fine control.
- `apps/web/components/reader/{ReaderColumn,KaraokeHighlighter,BionicText,
  FocusMode,SelectionMenu,ProgressRail,ReadingRuler}.tsx`: the full
  reader surface (auto-scroll keeps the current sentence in the upper
  third; data-attributes `data-word-idx`, `data-current-word`,
  `data-current-sentence` drive click-to-jump + CSS hooks).
- `apps/web/components/library/{ImportDropzone,ContinueShelf,DocCard}.tsx`:
  drag-drop + paste + file input; PDF via `pdfjs-dist`; DOCX via
  `mammoth`; MD/TXT native. ContinueShelf reconciles local IndexedDB
  positions with the BFF. DocCard renders the grid/list item shape.
- `apps/web/components/onboarding/Coachmarks.tsx`: 3-step non-blocking
  tour persisted via `localStorage`.
- `apps/web/components/shared/{ThemeSwitcher,CommandPalette,
  KeyboardShortcuts}.tsx`: light/dark/sepia/e-ink cycle,
  `cmdk`-powered Cmd/Ctrl+K palette, full 14-shortcut help sheet.
- `apps/web/app/(app)/library/page.tsx`: real library page with
  filter bar, ≤7-per-chunk + "Load more", command palette hooks,
  empty-state with ImportDropzone + "Try a sample" button.
- `apps/web/app/(reader)/[docId]/page.tsx`: real reader page wired to
  IndexedDB + BFF, with the full keyboard map (Space, ←/→, Shift+←/→,
  ↑/↓, J/K, R, F, B, T, /, ?, Esc).
- `apps/web/app/api/import/route.ts`: real POST handler — accepts text or
  URL; for URL fetches via the worker; builds the SegmentTree in-process
  (or via the Python worker when one is configured) and persists to
  Postgres.
- `apps/web/app/api/tts/route.ts`: NDJSON streaming proxy with
  `Transfer-Encoding: chunked` + `Content-Type: application/x-ndjson`.
  Returns `{audio, marks, done, chunkIndex}` frames.
- `apps/web/app/api/positions/stream/route.ts`: SSE endpoint with 30s
  heartbeat + `?since=` parameter + `event: position-update` frames per
  the spec.
- `services/worker-python/app/tasks/parse.py`: already real from Phase 1
  (Celery `parse_document` task builds the same SegmentTree shape the TS
  builder produces — see parity tests).
- Tests:
  - `packages/core/test/segment-tree.test.ts`: 23 tests pinning the TS
    builder, including a new abbreviation-aware split test
    (`Dr. Smith went to the U.S.`-style input).
  - `packages/core/src/player/speech-marks.test.ts`: 14 binary-search
    correctness tests (empty, before-first, after-last, large arrays).
  - `packages/core/src/player/karaoke-sync.test.ts`: 8 tests for emit
    ordering, change detection, drift reporting.
  - `packages/core/src/sync/idb-cache.test.ts`: 10 round-trip tests using
    `fake-indexeddb` across all 5 stores.
  - `apps/web/app/api/tts/route.test.ts`: 3 integration tests (401, 503,
    GET voices).
  - `apps/web/components/player/PlayerBar.test.tsx`: 4 component tests.
  - `apps/web/components/reader/KaraokeHighlighter.test.tsx`: 6
    component tests.
  - `apps/web/components/library/ImportDropzone.test.tsx`: 2 component
    tests.

### Stubbed (kept as Phase-2-but-deferred)
- ElevenLabs is the only real adapter; OpenAI / Azure / Google / Local
  still throw "not configured" — they ship as typed stubs so the
  `TTSRouter` can route once keys are added.
- The `/api/import` URL path proxies through `WORKER_API_URL` when set,
  falling back to a clear 502 if the worker is unreachable. The Celery
  `parse_document` task itself is real and tested in Python.
- `apps/web/lib/privy-verify.ts` is still the Phase-1 stub — real Privy
  verify is queued for the Phase-2 late step per the CHANGELOG note.
- SSE heartbeat tuning (we ship 30s; can be tightened when proxy chains
  are measured).

### Verified
- `pnpm -w typecheck` — clean across all 7 packages.
- `pnpm -w test` — 70 tests pass (55 core + 15 web), 0 fail.
- `pnpm --filter @readmaxxing/web build` — Next.js production build
  succeeds (reader route ≈ 45 KB raw / 162 KB first-load JS; library
  route ≈ 6 KB / 123 KB; under the 150 KB gzip target after Brotli).

### Decisions to revisit later
- Whether to switch from SSE polling to WebSockets once concurrent users grow.
- Whether to persist TTS audio server-side or keep per-device IndexedDB only.
- Whether to upgrade to Tailwind v4-beta to stable once v4 ships.

---

## [0.1.0] — 2026-06-25 — Phase 1 Foundations

### Added
- Turborepo + pnpm monorepo with 7 TS workspaces (`apps/web`, `packages/{ui,core,tts,ai,db,config}`) and 1 Python service (`services/worker-python`).
- Design system (`packages/ui`): warm-paper/Dark/Sepia/E-ink theme tokens, fluid body type (16–20px), 66ch measure, line-height 1.5–1.6, Atkinson Hyperlegible as dyslexia option, tabular figures, motion tokens, prefers-* media hooks, 7 Radix-based primitives (`Button`, `Card`, `Input`, `Slider`, `Tooltip`, `Dialog`, `DropdownMenu`).
- Core pipeline (`packages/core`): full plain-text -> `SegmentTree` builder (`pipeline/segment-tree.ts` — markdown headings, abbreviation-aware sentence splitter, contraction-aware tokenizer, `locateWord`, `globalWordOffset`). All 5 IndexedDB stores wired (`documents`, `segment-trees`, `audio-chunks`, `positions`, `user-preferences`) using `idb` — see `packages/core/src/sync/idb-cache.ts`. Position store: IndexedDB + debounced POST + SSE client stub interface.
- TTS abstraction (`packages/tts`): typed `TTSProvider` interface, `TTSRouter` (voice -> provider lookup, premium gating, latency budget), `SpeechMark` normalization + binary-search `findWordAtTime` (`packages/tts/src/speech-mark.ts`). Adapters typed (ElevenLabs/OpenAI/Local in `packages/tts/src/adapters/`); bodies throw "not configured" — Phase 2 wires real HTTP streaming.
- Database (`packages/db`): Prisma schema (`packages/db/prisma/schema.prisma`) with **22 models + 6 enums**. Habit tables (Streak, XpEvent, Badge, UserBadge, Quest, QuestCompletion, LeaderboardLeague, LeaderboardEntry, DailyGoal, Consent) seeded so later phases don't migrate. Audio jobs, podcast episodes, voice clones, usage ledger all modeled.
- Config (`packages/config`): zod-validated env (client + server), constants for speed presets [0.5–4.5], quick-tap speeds, XP values per action, Privy cookie name.
- LLM provider (`packages/ai`): real OpenRouter client via `fetch` against `https://openrouter.ai/api/v1/chat/completions`. Public surface: `complete()`, `stream()` (SSE), `completeJson<T>()`, prompt helpers `buildSummaryPrompt` / `buildQuizPrompt` / `buildRecapPrompt` / `buildAskPrompt` / `buildFillerPrompt` — all enforce the `[cite:p:s]` citation rule from `docs/UI-UX.md` §7. Default model `openai/gpt-4o-mini`. Headers include app metadata for OpenRouter dashboard debugging. No SDK dep.
- Python worker (`services/worker-python`): FastAPI app with `/health` + `/ready` + stubbed `/v1/parse` (501 until Phase 2), Celery app with queues for `parse`/`ocr`/`ai`/`podcast`/`tts`. Full task implementations: `parse.py` (segment tree mirroring TS builder exactly), `ocr.py` (PaddleOCR + Tesseract), `ai.py` (summary, quiz, recap, ask, fillers — all routed through OpenRouter), `podcast.py` (script generator + manifest writer; Phase 4 fills TTS-per-line + mastering), `tts.py` (sherpa-onnx stub for Phase 5). Shared `openrouter.py` HTTP client + prompt helpers matches the TS package one-for-one. `Dockerfile` (Python 3.12-slim, CPU, non-root), `pyproject.toml`, `requirements.txt` for Nixpacks, `railway.toml` in-service override.
- Next.js web app: App Router, `output: 'standalone'`, fonts loaded via `next/font/google` (`Source_Serif_4`, `Inter`, `Atkinson_Hyperlegible`), `PrivyProvider` + `QueryClientProvider` shells in `apps/web/app/providers.tsx`, Tailwind v4-beta via `@import "@readmaxxing/ui/globals.css"`. Privy middleware (`apps/web/middleware.ts`) gates `/api/*` (excludes `/api/auth/webhook` + `/api/health`). Health endpoint + Privy webhook (`apps/web/app/api/auth/webhook/route.ts`) that upserts User on `user.created` / `user.updated` / `user.linked_account`. Home page (`apps/web/app/page.tsx`) is a smoke test that renders a SegmentTree + speed presets.
- Railway config: root `railway.toml` for web, `.railway-worker.json` for worker with volume mount, `services/worker-python/railway.toml` in-service override.
- Docs: `README.md` (orientation), `docs/IMPLEMENTATION-STATUS.md` (phase tracker), `docs/DESIGN-SYSTEM.md` (exported token reference).

### Changed
- (none — first release)

### Decisions

**D1: OpenRouter as the single LLM gateway.** We use OpenRouter instead of calling OpenAI/Anthropic/Google directly so we can A/B models per feature (cheap model for summary, frontier model for podcast script) with one API key and automatic provider fallback. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are kept as documented bypass overrides. See `packages/ai/src/index.ts` and `services/worker-python/app/tasks/openrouter.py`.

**D2: Hybrid blob storage (Option B).** Text/positions/metadata live in Postgres for cross-device sync; uploaded raw files (PDFs) and TTS audio are cached per-device in IndexedDB only; AI podcast episodes are the exception (expensive to regenerate, meant to be re-listenable) and persist on a Railway persistent volume. Privacy win: raw uploaded files never leave the user's device.

**D3: No Supabase / S3 / R2.** Everything runs on Railway — Next.js, Python worker, Postgres, Redis, persistent volume — plus Privy for auth. One platform, one bill, private network between services. Sync via lightweight SSE polling (positions keyed by `updatedAt`) instead of WebSockets/Supabase Realtime. Sufficient for low-frequency position updates; revisit at scale.

**D4: Privy over NextAuth.** Privy gives us wallet/email/social auth with a single SDK, embeds nicely with the auth webhook -> Postgres user-mirror pattern (`apps/web/app/api/auth/webhook/route.ts`).

**D5: `packages/core` is pure-TS, no React.** The segment-tree builder, IndexedDB cache, position sync, and (in Phase 2) the audio engine live here so the Chrome extension and React Native mobile app reuse the exact same logic — the Single Source of Truth for cross-surface consistency (Nielsen's internal+external consistency rule from `docs/UI-UX.md` §11).

**D6: TTS speech-mark strategy varies by provider.** ElevenLabs returns native character-level marks via `streamWithTimestamps`. OpenAI TTS has no native marks, so we'll either Whisper-force-align post-synthesis or estimate from word count + duration. Azure and Google return native word boundary events. Local Piper/Kokoro via sherpa-onnx uses estimated timing. See the v1 plan §"Streaming-first audio".

**D7: Tailwind v4-beta.** Using `@import` to compose Tailwind sheets across packages (`apps/web/app/globals.css` imports `packages/ui/src/globals.css`). Upgrade to stable once v4 ships.

**D8: Performance budgets are UX requirements.** From `docs/UI-UX.md` §10: LCP < 1s, time-to-play < 1s, INP < 100ms, reader JS ≤ 150KB gzip, CLS < 0.05. These constraints shape architecture: streaming-first audio, web-worker parsing, route-split bundles. Phase 1 sets up the budgets (`apps/web/next.config.ts` notes the `pnpm size` CI gate to be added in Phase 2); every phase must keep them green.

**D9: Content-first UI per `docs/UI-UX.md` §1.** "The content is the hero." Player exposes only Play/Pause/scrubber/time by default; everything else behind a menu (progressive disclosure). Two-level karaoke (soft sentence tint + accent word fill, 120ms advance, no strobe). No mid-flow recommendations (decision fatigue). Honest time estimates on all AI jobs.

**D10: Habit layer is Duolingo-style high intensity** (per user decision): prominent flame streak, at-risk reminders, streak freeze + 24h recovery, leaderboards (opt-out in one tap, never shamed), XP + daily goal ring, identity-named milestone badges (2-Week Warrior, Century Reader, Marathon Listener, Speed Demon) with bronze/silver/gold tiers, weekly quests, weekly digest, shareable streaks. The guardrail is "pressure and play, never shame" — every loss is recoverable, no anxious-red styling on streak breaks.

**D11: Marquee/celebrity voice as first-run default.** Per user decision — the wow moment of hearing a famous voice read the user's own doc is a stronger activation hook than a neutral narrator. Choice paralysis mitigated by single bold default tile, one-tap "more voices" previewing on the user's text, full picker in Settings later. The `Voice.isMarquee` flag in the schema is the lever.

### Notes for future agents

- **Prisma client not generated yet.** Schema file is complete; user must run `pnpm db:generate && pnpm db:migrate` after `cp .env.example .env`. The `packages/db/src/index.ts` re-exports `@prisma/client` which is empty until that step.
- **Privy token verifier is a stub.** `apps/web/lib/privy-verify.ts` accepts `did:privy:*` and falls back permissively in dev. Phase 2 swaps it for `@privy-io/node`'s `PrivyClient.utils().auth().verifyAccessToken` — note `verifyAuthToken` was deprecated in v0.7.0; the TODO in the file has been updated to point at the new method. One-line change at the documented call-site. The webhook HMAC check in the same file is also a stub.
- **`pnpm install` was never run in this environment.** All TS workspaces were verified clean via a scratch symlink approach. Real install + Prisma generate + first migrate are user actions after env setup.
- **User's `.env` (committed to `.gitignore` — see file in repo root) IS the working `.env`** — the user explicitly chose on 2026-06-25 to keep real keys on disk under gitignore protection. `.env.example` exists as a sanitized template for other contributors and is safe to commit; `.env` itself stays on `.gitignore`.
- **No git repo yet.** First `git init` + commit should include `.env` in `.gitignore` (already done) and verify the working tree contains only safe files.
- **TTS adapters throw.** Phase 2 wires real ElevenLabs HTTP streaming + speech marks. Phase 5 wires local Piper/Kokoro via `services/worker-python/app/tasks/tts.py:synthesize`.
- **IndexedDB SSE client is stubbed.** The `PositionStore.subscribeRemote` interface is in place; Phase 2 implements the real EventSource against `/api/positions`.
- **Phase 2 number is `25` steps per the user's brief; Phase 3 is 10; Phase 4 is 8; Phase 5 is 16; Phase 6 covers extension + mobile.** If you find these numbers stale, update `docs/IMPLEMENTATION-STATUS.md` rather than this file.

### Known tech debt to track
- `services/worker-python/app/main.py` `/v1/parse` returns 501 — real Celery `app.tasks.parse.parse_document` task is the production path; the HTTP wrapper is a Phase 2 follow-up.
- `apps/web/app/page.tsx` is a smoke test only — Phase 2 replaces with the real library page.
- Privy verify stub (both identity-token and webhook HMAC) must be swapped before any real auth-gated route ships.
- Tailwind v4-beta should be re-evaluated at v4 stable.
- Worker Celery `parse_document`, `ocr_image`, and `ai.*` tasks exist and are real, but no BFF route currently enqueues them — Phase 2 (`/api/import`, `/api/ai/*`) closes that loop.
