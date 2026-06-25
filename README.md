# ReadMaxxing

> A Speechify-class voice AI reading app: lifelike TTS, karaoke highlighting, AI summaries / quizzes / podcasts, voice typing, voice cloning, OCR — all in a calm, fast, accessibility-first web app (with a path to Chrome extension and mobile).

This repo is the **v1** build. It is structured as a **Turborepo + pnpm** monorepo containing a Next.js 15 web app, a FastAPI/Celery Python worker, and the shared TypeScript/Python packages that all surfaces (web, extension, mobile) will consume.

> **Design law:** [`docs/UI-UX.md`](docs/UI-UX.md) is the source of truth for every UX rule. When code and that file disagree, the file wins.

---

## Repository layout

```
ReadMaxxing/
├── apps/
│   └── web/                       Next.js 15 App Router app (the web surface)
├── packages/
│   ├── ui/                        Design system: tokens, themes, primitives (per UI-UX.md)
│   ├── core/                      Shared TS model: SegmentTree, IndexedDB cache, position store
│   ├── tts/                       TTS provider abstraction + adapters (ElevenLabs, OpenAI, Local…)
│   ├── db/                        Prisma schema + generated client
│   ├── ai/                        LLM client (OpenRouter) + prompt helpers
│   └── config/                    Env validation, shared constants
├── services/
│   └── worker-python/             FastAPI + Celery worker: parsing, OCR, AI, podcasts, local TTS
├── docs/
│   ├── UI-UX.md                   Canonical design law
│   ├── DESIGN-SYSTEM.md           Tokens + primitives reference
│   └── IMPLEMENTATION-STATUS.md   Phase tracker for the next agent
├── .env.example                   Copy to .env, fill in
├── package.json                   Root scripts (pnpm + turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── railway.toml                   Multi-service Railway config (web + worker)
└── .railway-worker.json           Worker service overrides
```

Each subpackage has its own `README`/docstring explaining its slice.

---

## Quick start

### Prerequisites

- **Node.js** ≥ 20.11
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Python** ≥ 3.12 (for `services/worker-python`)
- **Postgres** ≥ 15 (local Docker or Railway Postgres)
- **Redis** ≥ 7 (local Docker or Railway Redis)

### 1. Install dependencies

```bash
pnpm install
```

> The network sandbox in some CI environments may be unreliable — if `pnpm install` fails locally, retry once or install on your machine.

### 2. Configure environment

```bash
cp .env.example .env
# fill in the values (see Environment variables below)
```

### 3. Database

```bash
# Generate Prisma client
pnpm db:generate

# Apply migrations to your local Postgres
pnpm db:migrate

# Or open Prisma Studio to inspect data
pnpm db:studio
```

### 4. Run dev servers

```bash
# Run every workspace's dev script (Turbo runs them in parallel)
pnpm dev

# Or individually:
pnpm --filter @readmaxxing/web dev
cd services/worker-python && uvicorn app.main:app --reload --port 8000
```

The web app runs on `http://localhost:3000` and the worker on `http://localhost:8000`.

### 5. Run Celery worker (separate terminal)

```bash
cd services/worker-python
celery -A app.celery_app:celery_app worker \
  -Q parse,ocr,ai,podcast,tts --loglevel=INFO
```

---

## Environment variables

All variables live in `.env` at the repo root. See [`.env.example`](.env.example) for the canonical template.

| Var                              | Required | Where it’s read                       |
| -------------------------------- | -------- | ------------------------------------- |
| `DATABASE_URL`                   | yes      | web + worker                          |
| `REDIS_URL`                      | yes      | web + worker                          |
| `NEXT_PUBLIC_PRIVY_APP_ID`       | yes      | web (browser + server)                |
| `PRIVY_APP_SECRET`               | yes      | web (server)                          |
| `PRIVY_WEBHOOK_SECRET`           | yes      | web (server, webhook)                 |
| `WORKER_API_URL`                 | yes      | web (BFF → worker)                    |
| `WORKER_API_TOKEN`               | yes      | web ↔ worker handshake                |
| `OPENROUTER_API_KEY`             | yes      | worker (LLM) — see below              |
| `ELEVENLABS_API_KEY`             | optional | worker (cloud TTS)                    |
| `OPENAI_API_KEY`                 | optional | direct access override               |
| `ANTHROPIC_API_KEY`              | optional | direct access override               |
| `NEXT_PUBLIC_APP_URL`            | yes      | web                                   |

### LLM provider

We use **OpenRouter** ([openrouter.ai](https://openrouter.ai/)) as the primary LLM path. One API key gives us access to OpenAI, Anthropic, Google, Meta, Mistral, and other providers, with automatic fallback. Set `OPENROUTER_API_KEY` in `.env` and you can call any model id (e.g. `"openai/gpt-4o-mini"`, `"anthropic/claude-3-5-sonnet"`, `"google/gemini-2.5-pro"`) without per-provider SDKs.

`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are kept as optional direct-access overrides if you want to bypass OpenRouter.

---

## Database

- **Provider:** Railway Postgres in production; local Postgres in dev.
- **ORM:** Prisma. Schema lives in [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma).
- **Tables:** `User`, `Document`, `PlaybackPosition`, `AudioJob`, `Voice`, `Summary`, `Quiz`, `QuizAttempt`, `Note`, `Podcast`, `PodcastEpisode`, `Streak`, `XpEvent`, `Badge`, `UserBadge`, `Quest`, `QuestCompletion`, `LeaderboardLeague`, `LeaderboardEntry`, `DailyGoal`, `UsageLedger`, `Consent`.
- **Blob strategy (hybrid):**
  - Segment tree text + metadata → Postgres (`Document.segmentTree` JSONB).
  - Raw uploaded files → IndexedDB (client-side only).
  - Regular TTS audio → IndexedDB per device.
  - AI Podcast episodes → Railway persistent volume (re-listenable).

---

## Deploying to Railway

This repo is wired for Railway multi-service deploys. See [`railway.toml`](railway.toml) for the multi-service plan and [`services/worker-python/`](services/worker-python) for the worker’s Dockerfile.

Services expected in production:

1. **`web`** — Next.js app (this repo's root, `pnpm build` → `pnpm start`).
2. **`worker-python`** — FastAPI HTTP + Celery worker (built from `services/worker-python/Dockerfile`).
3. **`postgres`** — Railway Postgres.
4. **`redis`** — Railway Redis.
5. **`podcast-volume`** — Railway persistent volume mounted into `worker-python` at `/data/podcasts`.

Set the env vars above in each service's Railway tab. Privy dashboard URL is `https://dashboard.privy.io/`.

---

## Phase roadmap

| Phase | Theme                           | Status (see [`IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md)) |
| ----- | ------------------------------- | ------------------------------------------------------------------------ |
| 1     | Foundations                     | **Complete** (scaffold + stubs)                                          |
| 2     | Reader Core (import + player)   | Entry points stubbed; ready for the next agent                           |
| 3     | AI Layer (summary, quiz, recap) | Worker tasks live; BFF routes pending                                    |
| 4     | AI Podcasts + Voice Assistant   | Script stage live (OpenRouter); TTS + mastering pending                  |
| 5     | Voice Typing / Cloning / OCR    | OCR engines installed; local TTS + cloning pending                       |
| 5.5   | Habit & motivation layer        | Schema only                                                              |
| 6     | Chrome extension + Mobile       | Not started                                                              |

The full plan lives at `.cursor/plans/readmaxxing_v1_plan_9ab9b0ad.plan.md` (high-level) and the detailed per-file plan is `.cursor/plans/readmaxxing_detailed_impl_9602e36a.plan.md` (your source of truth when implementing a phase).

---

## Current Status (Phase 1 closeout)

**What's in production shape**

- **Monorepo.** Turborepo + pnpm workspaces, strict TypeScript, path aliases for `@readmaxxing/*`, Nixpacks-ready Railway config.
- **Web app.** Next.js 15 (App Router) + React 19 + Tailwind v4 (PostCSS). Privy middleware (`apps/web/middleware.ts`) + Privy webhook handler (`apps/web/app/api/auth/webhook/route.ts`) with HMAC verification + `/api/health`. Root layout, providers, page, and globals are wired. Phase 2 entry-point routes exist at `/library` and `/reader/[docId]` and import `ContinueShelf` / `ReaderColumn` stubs.
- **Design system (`packages/ui`).** Tailwind v4 tokens declared in the `@theme` block of `packages/ui/src/globals.css`; consumed by the web app via `@import "@readmaxxing/ui/globals.css"`. Four themes (Light / Dark / Sepia / E-ink) injected from `themes.ts` as CSS custom properties on `[data-theme]`. Primitives: Button, Card, Input, Slider, Tooltip, Dialog, DropdownMenu.
- **Shared core (`packages/core`).** `SegmentTree` types + `buildSegmentTree` builder (TS) mirroring the Python builder exactly. IndexedDB cache (`idb-cache.ts`), position store, sync indices.
- **AI client (`packages/ai`).** Real OpenRouter client using `fetch` against `https://openrouter.ai/api/v1/chat/completions`. `complete`, `stream`, `completeJson`, and prompt helpers for summary / quiz / recap / ask-the-doc / fillers. **No OpenAI / Anthropic SDK imports anywhere in the package.**
- **TTS provider (`packages/tts`).** `TTSProvider` interface, `SpeechMark` types, `TTSRouter`, adapters for ElevenLabs / OpenAI / Local. Adapters are stubs that throw on `streamSynthesize` — Phase 2 wires the real HTTP streaming + speech-mark alignment.
- **Prisma schema (`packages/db`).** All 19 tables incl. habit tables (`Streak`, `XpEvent`, `Badge`, `UserBadge`, `Quest`, `QuestCompletion`, `LeaderboardLeague`, `LeaderboardEntry`, `DailyGoal`).
- **Env validation (`packages/config`).** Zod schemas for client + server env; typed `loadEnv("client" | "server")`.
- **Python worker (`services/worker-python`).** FastAPI HTTP server, Celery app bound to `REDIS_URL`, Pydantic Settings. Tasks: `parse.parse_document`, `ocr.ocr_image`, `ai.{generate_summary,generate_quiz,generate_recap,ask_document,detect_fillers}`, `podcast.generate_podcast`, `tts.synthesize` (stub). All AI tasks call OpenRouter via `app.tasks.openrouter` — **no OpenAI / Anthropic SDKs**.
- **Railway config.** Root `railway.toml` (web service, Nixpacks), `.railway-worker.json` (worker service, Dockerfile + volume mount), `services/worker-python/railway.toml` (in-service override).

**What is a stub (callable but not production-ready)**

- `packages/tts` adapters — `streamSynthesize` throws "not configured" everywhere. Phase 2 wires real streaming.
- `packages/tts/src/adapters/local.ts` and `xtts` — TypeScript-side stubs; real `sherpa-onnx` / Coqui XTTS integration lives in the worker.
- `services/worker-python/app/tasks/tts.synthesize` — returns `{status: "stub"}` until the Piper/Kokoro onnx model is mounted in Phase 5.
- `services/worker-python/app/tasks/podcast.generate_podcast` — writes a JSON manifest to the volume; Phase 4 produces actual audio.
- `services/worker-python/app/main.py` `/v1/parse`, `/v1/ai/summary`, `/v1/tts/stream`, `/v1/ocr` — return 501; the real work happens via Celery tasks.
- `apps/web/lib/privy-verify.ts` — accepts locally-shaped tokens (`did:privy:...` and a permissive dev fallback). Phase 2 swaps the body for `PrivyClient.utils().auth().verifyAccessToken` (note: `verifyAuthToken` was deprecated in `@privy-io/node` v0.7.0).
- `apps/web/app/api/{import,positions,tts}/route.ts` — all return 501 with a clear "Phase 2 will wire …" message.

**Habit layer (Phase 5.5)** — schema only. No application code yet; `streaks`, `xp_events`, `badges`, `user_badges`, `quests`, `leaderboard_leagues`, `daily_goals` tables are provisioned so the next phases don't add migrations.

---

## Quickstart for Phase 2 (Reader Core)

The next agent's first five concrete steps:

1. **Wire the import pipeline.** Replace the 501 stub at `apps/web/app/api/import/route.ts` with a handler that accepts `paste | file | url`, runs the source extraction (PDF / DOCX / MD / EPUB via worker Celery tasks; URL via Playwright + Readability), upserts the resulting `SegmentTree` into the `Document.segmentTree` JSONB column, and returns `{ documentId, status }`.
2. **Build the reader primitives.** Add `Player`, `KaraokeHighlighter`, `ReaderColumn`, and `VoicePicker` to `packages/ui/src/primitives/` so they're shared with the Chrome extension and mobile app. Replace the `ReaderColumn` stub at `apps/web/components/reader/ReaderColumn.tsx` with a real implementation that reads the segment tree and binds the active word from `Player`.
3. **Stream the audio + speech marks.** Replace the 501 stub at `apps/web/app/api/tts/route.ts` with a `Response` that pipes `provider.streamSynthesize(...)` chunks via `Transfer-Encoding: chunked` and a parallel `application/x-ndjson` channel of speech marks. Cache audio + marks per `(documentId, chunkIndex)` in IndexedDB.
4. **Cross-device resume.** Replace the 501 stub at `apps/web/app/api/positions/route.ts` with an SSE handler that streams `PlaybackPosition` updates from Postgres, polls every ~1.5 s, and closes when the client disconnects. Merge with the IndexedDB cache so resume-to-the-exact-word works offline.
5. **Bring up the library.** Fill in the `ContinueShelf` stub at `apps/web/components/library/ContinueShelf.tsx` so `/library` renders the in-progress docs as a horizontal shelf (≤ 7 visible, Miller's Law) and `/reader/[docId]` resumes at the exact word. Add the calm grid/list with filters and `Cmd/Ctrl+K` search per UI-UX.md §6.

Full phase checklist lives in [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md).

---

## Quality gates

- **TypeScript strict** (see [`tsconfig.base.json`](tsconfig.base.json)).
- **Lint:** `pnpm lint`.
- **Typecheck:** `pnpm typecheck`.
- **Format:** Prettier defaults (run `pnpm format`).
- **WCAG 2.2 AA** is the accessibility floor; the reading surface targets AAA.

Performance budgets (per `docs/UI-UX.md §10`): **LCP < 1.0 s**, **time-to-play < 1 s**, **INP < 100 ms**, **reader JS ≤ 150 KB gzip**, **CLS < 0.05**.

---

## License

Proprietary — internal build. © ReadMaxxing.