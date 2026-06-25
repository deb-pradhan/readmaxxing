# ReadMaxxing — Changelog & Decision Log

All notable changes to ReadMaxxing are recorded here. New agents and humans:
read this file first to understand *what was built, why it was built that way,
and what tradeoffs were accepted*.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/) with
an added "Decisions" section per release that captures the why behind the what.

> **Companion docs:** `README.md` (orientation), `docs/UI-UX.md` (canonical
> design law), `docs/IMPLEMENTATION-STATUS.md` (live phase tracker),
> `docs/DESIGN-SYSTEM.md` (tokens + primitives reference). When this file
> disagrees with `docs/IMPLEMENTATION-STATUS.md`, the status file wins —
> it tracks current state; this file records history.

---

## [Unreleased] — Phase 2 onwards

### What changes next
- Phase 2 — Reader Core (25 steps): streaming TTS proxy, Web Audio engine,
  karaoke sync, PlayerBar/KaraokeHighlighter/ReaderColumn, library + onboarding,
  SSE positions endpoint, theme/command palette/shortcuts.
- Phase 3 — AI Layer (10 steps): LLM provider is OpenRouter (one key, any model);
  summary/quiz/recap/ask/filler prompts with citation rule.
- Phase 4 — AI Podcasts + Voice Assistant (8 steps): multi-speaker script generator
  -> TTS per line -> master -> Railway volume storage.
- Phase 5 — Voice Typing, Voice Cloning, OCR, Habit Layer (16 steps).
- Phase 6 — Chrome extension (MV3) + Expo/RN mobile (shared packages).

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
