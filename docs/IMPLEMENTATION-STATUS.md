# ReadMaxxing — Implementation Status

> **You are a future agent starting on this codebase. Read this file first.**
> It tells you what is real, what is a stub, and what the next phase needs.

The full v1 plan lives at `.cursor/plans/readmaxxing_v1_plan_9ab9b0ad.plan.md` (high-level) and `.cursor/plans/readmaxxing_detailed_impl_9602e36a.plan.md` (detailed). The UI/UX source of truth is `docs/UI-UX.md`. This file is the *current* state — what's actually in the repo.

> **LLM provider note.** OpenRouter is the **only** LLM gateway in this repo. The TS client at `packages/ai/src/index.ts` and the Python client at `services/worker-python/app/tasks/openrouter.py` both talk to `https://openrouter.ai/api/v1/chat/completions` via `fetch` / `httpx`. There are no `openai` / `anthropic` SDKs anywhere in the workspace — `grep -r "openai\|anthropic" packages/` returns only one comment in `packages/tts/src/adapters/openai.ts` (a Phase 2 note). To swap models, change the `model` field — `openai/gpt-4o-mini`, `anthropic/claude-3-5-sonnet`, `google/gemini-2.5-pro`, etc. all flow through the same path.

---

## Phase 1 — Foundations

**Status: complete.** Monorepo, web app, design system, AI client (OpenRouter), Python worker, Railway multi-service config, and Phase 2 entry-point routes/components are all in place.

### Real (in production shape)

- **Monorepo:** Turborepo + pnpm workspaces (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`).
- **Web app (`apps/web`):**
  - Next.js 15 (App Router) + React 19 + Tailwind v4 (PostCSS, `@tailwindcss/postcss`).
  - Tailwind v4 theme tokens declared in the `@theme` block of `packages/ui/src/globals.css` and consumed by the web app via `@import "@readmaxxing/ui/globals.css"`.
  - Privy middleware (`apps/web/middleware.ts`) + webhook handler (`apps/web/app/api/auth/webhook/route.ts`) with HMAC verification.
  - `/api/health` route, providers shell, layout, page, globals.
  - `lib/privy-verify.ts` — clean Phase 1 stub with a single `verifyPrivyIdentityToken(token)` returning `{userId, email?}` and a clearly-marked TODO for Phase 2 to swap in `PrivyClient.utils().auth().verifyAccessToken` (note: `verifyAuthToken` was deprecated in `@privy-io/node` v0.7.0).
  - **Phase 2 entry points:** `app/(app)/library/page.tsx`, `app/(app)/reader/[docId]/page.tsx`, plus the `ContinueShelf` / `ReaderColumn` component stubs and 501 stubs for `/api/import`, `/api/positions`, `/api/tts`.
- **Design system (`packages/ui`):** tokens, themes (Light / Dark / Sepia / E-ink via `themes.ts`), fonts, `cn()` util, primitives (Button, Card, Input, Slider, Tooltip, Dialog, DropdownMenu), globals, index.
- **Shared core (`packages/core`):** `SegmentTree` types + builder (`pipeline/segment-tree.ts`), IndexedDB cache, position store, sync indices.
- **TTS provider (`packages/tts`):** `TTSProvider` interface, `SpeechMark` types, `TTSRouter`, adapters (ElevenLabs, OpenAI, Local). All adapters are *stubs that throw on `streamSynthesize`* — Phase 2 wires the real HTTP streaming.
- **Prisma schema (`packages/db`):** complete — User, Document, PlaybackPosition, AudioJob, Voice, Summary, Quiz, QuizAttempt, Note, Podcast, PodcastEpisode, Streak, XpEvent, Badge, UserBadge, Quest, QuestCompletion, LeaderboardLeague, LeaderboardEntry, DailyGoal, UsageLedger, Consent.
- **Env validation (`packages/config`):** Zod schemas for client/server env.
- **AI client (`packages/ai`):** **real OpenRouter client** (`complete`, `stream`, `completeJson`) plus prompt helpers for summary, quiz, recap, ask-the-doc, filler detection. No SDK dependency — uses `fetch` against `https://openrouter.ai/api/v1/chat/completions`.
- **Python worker (`services/worker-python`):**
  - FastAPI HTTP server with `/health`, `/ready`, stubbed `/v1/parse`.
  - Celery app bound to `REDIS_URL`, queues wired for `parse`, `ocr`, `ai`, `podcast`, `tts`.
  - Tasks:
    - `app.tasks.openrouter` — shared `httpx` client + prompt helpers (`summary_messages`, `quiz_messages`, `recap_messages`, `ask_messages`, `filler_messages`, `podcast_script_messages`). Mirrors `packages/ai/src/index.ts`.
    - `app.tasks.parse.parse_document` — Python builder mirroring `packages/core/src/pipeline/segment-tree.ts`.
    - `app.tasks.ocr.ocr_image` — PaddleOCR + Tesseract engines.
    - `app.tasks.ai.{generate_summary, generate_quiz, generate_recap, ask_document, detect_fillers}` — OpenRouter via `app.tasks.openrouter`.
    - `app.tasks.podcast.generate_podcast` — OpenRouter script + manifest written to `PODCAST_VOLUME_PATH`.
    - `app.tasks.tts.synthesize` — sherpa-onnx stub returning `{status: "stub"}` until Phase 5.
  - `Dockerfile` (Python 3.12-slim), `pyproject.toml`, `requirements.txt` (Nixpacks), `.dockerignore`, `railway.toml`, `README.md`.
- **Railway config:**
  - `railway.toml` (web service).
  - `.railway-worker.json` (worker service with Dockerfile + volume mount).
  - `services/worker-python/railway.toml` (in-service override).
- **Root `README.md`:** orienting doc with a "Current Status" section and a "Quickstart for Phase 2" 5-step list.
- **`.env.example`:** `OPENROUTER_API_KEY` documented as the primary LLM key, with optional `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` direct-access overrides.

### Stubbed (callable but not production-ready)

- `packages/tts` adapters: `getVoices()` returns static lists; `streamSynthesize` throws "not configured" — Phase 2 wires the real HTTP streaming + speech-mark alignment.
- `packages/ai` `complete` / `stream` / `completeJson`: real OpenRouter client, but no caching layer yet (every call hits OpenRouter). Phase 3 wraps these with a Redis cache keyed by `(model, prompt-hash)`.
- `services/worker-python/app/tasks/tts.synthesize`: returns `{status: "stub"}` — Phase 5 mounts the Piper/Kokoro onnx model.
- `services/worker-python/app/tasks/podcast.generate_podcast`: writes a JSON manifest to the volume; Phase 4 produces actual audio.
- `services/worker-python/app/main.py` `/v1/parse`, `/v1/ai/summary`, `/v1/tts/stream`, `/v1/ocr`: return 501; the actual work happens via Celery tasks.
- `apps/web/lib/privy-verify.ts`: accepts locally-shaped tokens (`did:privy:...` and a permissive dev fallback). Phase 2 swaps the body for `PrivyClient.utils().auth().verifyAccessToken` (`verifyAuthToken` was deprecated in `@privy-io/node` v0.7.0).
- `apps/web/app/api/{import,positions,tts}/route.ts`: all return 501 with a clear "Phase 2 will wire …" message.

### Habit tables (Phase 5.5)

Schema is in place (Streak, XpEvent, Badge, UserBadge, Quest, QuestCompletion, LeaderboardLeague, LeaderboardEntry, DailyGoal). No application code yet.

---

## Phase 2 — Reader Core (import + player)

**Status: not started.** Entry-point routes, components, and API stubs are wired; the next agent's job is to replace the 501s and the empty stub bodies with real implementations.

### Phase 2 checklist (25 steps, from the detailed plan §10)

1. Build the import surface (`apps/web/app/(app)/import`) — paste, drop, URL.
2. Wire `POST /api/import` to enqueue `app.tasks.parse.parse_document` and upsert `Document.segmentTree`.
3. Build the `Player` primitive in `packages/ui/src/primitives/Player.tsx`.
4. Build `KaraokeHighlighter` in `packages/ui/src/primitives/KaraokeHighlighter.tsx`.
5. Build `ReaderColumn` in `packages/ui/src/primitives/ReaderColumn.tsx` and replace the stub at `apps/web/components/reader/ReaderColumn.tsx`.
6. Build `VoicePicker` in `packages/ui/src/primitives/VoicePicker.tsx`.
7. Build `apps/web/app/api/tts/route.ts` streaming proxy with speech marks.
8. Implement the IndexedDB cache in `packages/core/src/sync/idb-cache.ts` (already real — wire UI consumers).
9. Implement the position store in `packages/core/src/sync/position-store.ts` (already real — wire UI consumers).
10. Wire SSE position sync (`apps/web/app/api/positions/route.ts`).
11. TTS adapters: replace `throw new Error("not configured")` with the real streaming HTTP client + forced-alignment speech marks.
12. Replace `ContinueShelf` stub at `apps/web/components/library/ContinueShelf.tsx` with a real shelf driven by `PlaybackPosition[]`.
13. Add the calm grid/list at `/library` with filters + `Cmd/Ctrl+K` search (≤ 7 per chunk, "Load more").
14. Add the Bionic Reading toggle (opt-in per UI-UX.md §5).
15. Add auto-scroll keeping the current sentence in the upper third.
16. Add focus mode (`F` key) dimming non-current paragraphs.
17. Add one-tap theme switch with system + time-of-day auto (UI-UX.md §5).
18. Add reading ruler / line guide option.
19. Wire click-any-word → audio seek (text↔audio binding, UI-UX.md §5).
20. Add selection actions: "Listen from here" / "Summarize this" / "Ask about this" / "Copy".
21. Add thin progress rail + "X% • Y min left" (endowed progress).
22. Add Media Session API hooks (background/lock-screen/media-keys).
23. Add offline-first playback from IndexedDB (zero network after first play).
24. Replace the 3-step coachmark skeleton + sample doc pre-load (UI-UX.md §6).
25. Performance pass: LCP < 1 s, INP < 100 ms, reader JS ≤ 150 KB gzip, CLS < 0.05 (UI-UX.md §10).

---

## Phase 3 — AI Layer (summary, quiz, recap, ask)

**Status: foundation laid.** `packages/ai` is real; worker `app.tasks.ai` is real; the BFF doesn't yet call them.

Next:

1. Build `apps/web/app/api/ai/summary`, `/quiz`, `/recap`, `/ask` route handlers.
2. Persist results into `Summary`, `Quiz`, `QuizAttempt`, `Note` tables.
3. Add a Redis cache keyed by `(documentId, prompt-hash)` so repeat AI calls are cheap.
4. UI surfaces in `packages/ui` (Summary card, Quiz card, Recap banner, Ask-the-doc sheet).

---

## Phase 4 — AI Podcasts + Voice Assistant

**Status: stub.** `app.tasks.podcast.generate_podcast` writes a JSON manifest; TTS-per-line and mastering are pending.

Next:

1. In `services/worker-python/app/tasks/podcast.py`, call `app.tasks.tts.synthesize` per line.
2. Master the per-line audio with `pydub` (gaps, optional music bed).
3. Write the mastered MP3 to `PODCAST_VOLUME_PATH/<document_id>/<episode_id>.mp3`.
4. Add `apps/web/app/api/podcasts/route.ts` to stream the audio via the BFF.
5. Build the podcast feed UI + "talk with the hosts" mode (LLM turn-by-turn).

---

## Phase 5 — Voice Typing, Voice Cloning, OCR

**Status: OCR engines installed; local TTS stubbed; cloning pending.**

Next:

1. Voice typing: Web Speech API in the browser + Whisper fallback in the worker; LLM cleanup via OpenRouter with a diff-view UI (never silently rewrite).
2. Voice cloning: explicit consent flow, `app.tasks.tts.clone_voice` (XTTS), `Consent` row required.
3. OCR: `app.tasks.ocr.ocr_image` is real — wire the BFF + UI for "Scan & Listen".

---

## Phase 6 — Chrome extension + Mobile

**Status: not started.** Shared packages (`@readmaxxing/ui`, `@readmaxxing/core`) are already framework-agnostic, so these can be added without rework.

---

## Repo conventions

- **TypeScript:** strict, no `any`. Path aliases live in `tsconfig.base.json` (`@readmaxxing/*`).
- **Python:** Python 3.12, ruff + mypy strict. Async-by-default for IO.
- **LLM:** always OpenRouter. Use the prompt helpers in `packages/ai/src/prompt-helpers` (TS) and `services/worker-python/app/tasks/openrouter.py` (Python) so the system prompts stay in sync.
- **Env vars:** never `process.env.X` outside `packages/config/src/env.ts` (TS) or `app.config.Settings` (Python). Add new vars to both schemas.
- **Commits:** one logical change per commit. Run `pnpm typecheck` and `pnpm lint` before committing.

## What to read first (cheat sheet)

1. `README.md` — repo orientation.
2. `docs/UI-UX.md` — design law.
3. `docs/DESIGN-SYSTEM.md` — token + primitive reference.
4. `packages/db/prisma/schema.prisma` — every table you'll touch.
5. `packages/core/src/pipeline/segment-tree.ts` — the canonical document model.
6. `services/worker-python/app/tasks/openrouter.py` — how AI calls are made.
7. `packages/ai/src/index.ts` — the TS-side LLM client.