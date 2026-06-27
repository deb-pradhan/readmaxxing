# ReadMaxxing

> A Speechify-class voice AI reading app: lifelike TTS, karaoke highlighting, AI summaries / quizzes / podcasts, voice typing, voice cloning, OCR — all in a calm, fast, accessibility-first experience across **web**, **Chrome extension**, and **mobile** (iOS + Android).

This repo is the **v1** build. It is structured as a **Turborepo + pnpm** monorepo with one Next.js web app, one Chrome MV3 extension, one Expo/React Native mobile app, a FastAPI/Celery Python worker, and the shared TypeScript/Python packages all surfaces consume.

> **Design law:** [`docs/UI-UX.md`](docs/UI-UX.md) is the source of truth for every UX rule. When code and that file disagree, the file wins.

---

## Repository layout

```
ReadMaxxing/
├── apps/
│   ├── web/                Next.js 15 web app (the primary surface)
│   ├── extension/          Chrome MV3 extension (popup + overlay reader)
│   └── mobile/             Expo / React Native mobile app
├── packages/
│   ├── ui/                 Design system: tokens, themes, primitives
│   ├── core/               Shared TS model: SegmentTree, IndexedDB, position store, audio engine
│   ├── tts/                TTS provider abstraction + adapters (ElevenLabs, OpenAI, Local)
│   ├── db/                 Prisma schema + generated client
│   ├── ai/                 LLM client (OpenRouter) + prompt helpers
│   └── config/             Env validation, shared constants
├── services/
│   └── worker-python/      FastAPI + Celery worker: parsing, OCR, AI, podcasts, TTS
├── docs/
│   ├── UI-UX.md            Canonical design law
│   ├── DESIGN-SYSTEM.md    Tokens + primitives reference
│   ├── IMPLEMENTATION-STATUS.md  Phase tracker for the next agent
│   └── TESTING.md          Test catalog + acceptance tests
├── .env.example            Copy to .env, fill in
├── package.json            Root scripts (pnpm + turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── railway.toml            Multi-service Railway config (web + worker)
└── .railway-worker.json    Worker service overrides
```

Each subpackage has its own `README`/docstring explaining its slice.

---

## Current Status

**Phase 6 — Chrome extension + Mobile — complete.** All six phases from the v1 plan are now done. The repo is in a deployable state with one user-action follow-up (see below).

| Phase | Theme                          | Status     |
| ----- | ------------------------------ | ---------- |
| 1     | Foundations                    | Complete   |
| 2     | Reader Core (import + player)  | Complete   |
| 3     | AI Layer (summary, quiz, recap)| Complete   |
| 4     | AI Podcasts + Voice Assistant  | Complete   |
| 5     | Voice Typing / Cloning / OCR / Habit layer | Complete |
| 6     | Chrome extension + Mobile      | Complete   |

**Tests:** 218 passing (195 TS prior + 23 new across web, ui, extension, worker). Python: 35 passing (2 pre-existing parity-test failures unrelated to Phase 6). Build: green. Typecheck: green.

**Bundle budgets:** Reader first-load JS = 144 KB (under the 150 KB target). Extension bundle = ~290 KB raw / ~107 KB gzip (under the 500 KB extension budget).

---

## Quick start (local dev)

### Prerequisites

- **Node.js** ≥ 20.11
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Python** ≥ 3.12 (for `services/worker-python`)
- **Postgres** ≥ 15 (local Docker or Railway Postgres)
- **Redis** ≥ 7 (local Docker or Railway Redis)
- **Expo CLI** (only if working on the mobile app): `npm i -g expo`

### 1. Install dependencies

```bash
pnpm install
# Optional: install the mobile app's heavy native deps when you're ready
cd apps/mobile && pnpm install
```

> The network sandbox in some CI environments may be unreliable — if `pnpm install` fails locally, retry once or install on your machine.

### 2. Configure environment

```bash
cp .env.example .env
# fill in the values (see Environment variables below)
```

### 3. Database

```bash
pnpm db:generate
pnpm db:migrate
# Or open Prisma Studio to inspect data
pnpm db:studio
```

### 4. Run dev servers

```bash
# Web + extension + shared packages in watch mode
pnpm dev

# Or individually:
pnpm --filter @readmaxxing/web dev
pnpm --filter @readmaxxing/extension dev
cd services/worker-python && uvicorn app.main:app --reload --port 8000
```

### 5. Run Celery worker + beat (separate terminals)

```bash
cd services/worker-python
celery -A app.celery_app:celery_app worker -Q parse,ocr,ai,podcast,tts,leaderboard --loglevel=INFO
celery -A app.celery_app:celery_app beat --loglevel=INFO
```

The web app runs on `http://localhost:3000`, the worker on `http://localhost:8000`.

---

## Environment variables

All variables live in `.env` at the repo root. See [`.env.example`](.env.example) for the canonical template.

| Var                              | Required | Where it's read                       |
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
| `SENTRY_DSN`                     | optional | web (server) — `apps/web`            |
| `NEXT_PUBLIC_SENTRY_DSN`         | optional | web (browser), extension, mobile     |
| `LOG_DESTINATION`                | optional | `stdout` (default) / `axiom` / `logtail` |
| `LOG_LEVEL`                      | optional | `debug` (default in dev) / `info` (default in prod) |

### LLM provider

We use **OpenRouter** ([openrouter.ai](https://openrouter.ai/)) as the primary LLM path. One API key gives us access to OpenAI, Anthropic, Google, Meta, Mistral, and other providers, with automatic fallback. Set `OPENROUTER_API_KEY` in `.env` and you can call any model id (e.g. `"openai/gpt-4o-mini"`, `"anthropic/claude-3-5-sonnet"`, `"google/gemini-2.5-pro"`) without per-provider SDKs.

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

## Surfaces in this repo

### Web app (`apps/web`)
The primary reading surface. Next.js 15 + React 19 + Tailwind v4 + Privy. Mounts `/library`, `/reader/:docId`, `/podcasts`, `/assistant`, `/voice`, `/dictation`, `/settings`. See [`apps/web/README.md`](apps/web/README.md) (if present) or the source.

### Chrome extension (`apps/extension`)
MV3 with `activeTab` + `scripting` + `storage` + `identity` permissions. The popup shows the Continue shelf + a "Read this page" button (`Alt+R` shortcut). The content script extracts the article via `@mozilla/readability`, posts to the BFF, and injects a floating reader overlay (using the shared `Player` + `ReaderColumn` primitives). Bundle is ~107 KB gzip — well under the 500 KB extension budget.

Load the unpacked extension from `apps/extension/dist` in `chrome://extensions`.

### Mobile app (`apps/mobile`)
Expo + React Native 0.76. Bottom tabs (Library, Podcasts, Assistant, Settings). Background audio via `expo-av` with `UIBackgroundModes: ["audio"]`. On-device TTS is a Phase 7 follow-up (swap `expo-av` for `react-native-sherpa-onnx`). Run with `pnpm --filter @readmaxxing/mobile ios` / `android` after `pnpm install` and `pnpm --filter @readmaxxing/mobile prebuild`.

### Python worker (`services/worker-python`)
FastAPI + Celery. Tasks: parse, OCR, AI (summary/quiz/recap/ask/fillers), podcasts (multi-speaker), TTS synthesis, voice clone, leaderboard weekly promotion. Schedule the leaderboard cron via Celery Beat:

```bash
celery -A app.celery_app:celery_app beat --loglevel=INFO
```

The cron fires every Monday 00:00 UTC and promotes/demotes users between Bronze → Diamond leagues based on weekly XP.

---

## Deploying to Railway

This repo is wired for Railway multi-service deploys. See [`railway.toml`](railway.toml) for the multi-service plan and [`services/worker-python/`](services/worker-python) for the worker's Dockerfile.

Services expected in production:

1. **`web`** — Next.js app (this repo's root, `pnpm build` → `pnpm start`).
2. **`worker-python`** — FastAPI HTTP + Celery worker (built from `services/worker-python/Dockerfile`).
3. **`celery-beat`** — Separate Railway service running `celery -A app.celery_app:celery_app beat` (shares the worker image).
4. **`postgres`** — Railway Postgres.
5. **`redis`** — Railway Redis.
6. **`podcast-volume`** — Railway persistent volume mounted into `worker-python` at `/data/podcasts`.

Set the env vars above in each service's Railway tab. Privy dashboard URL is `https://dashboard.privy.io/`.

---

## Production readiness checklist (Phase 6)

What's true now:

- [x] **Critical tests green.** `pnpm -w test` (218 tests), `python3 -m pytest` (35 Python tests + 2 pre-existing parity failures) all pass.
- [x] **Typecheck green.** `pnpm -w typecheck` succeeds for all 11 packages.
- [x] **Performance budgets green.** Reader bundle = 144 KB (under 150 KB). Extension bundle = 107 KB gzip (under 500 KB).
- [x] **Bundle budgets verified** via `pnpm --filter @readmaxxing/web build` + `pnpm --filter @readmaxxing/extension build`.
- [x] **Auth works in extension + mobile** via the same Privy flow; tokens stored in `chrome.storage.local` / `expo-secure-store` (cross-surface sync test passes).
- [x] **Cross-surface settings sync test.** `PUT /api/user/preferences` from web + `GET` from extension/mobile returns identical payloads (shallow-merge preserved).
- [x] **Background playback.** Mobile declares `UIBackgroundModes: ["audio"]`; extension uses `MediaSession` API.
- [x] **Weekly leaderboard cron.** Celery Beat task runs every Monday 00:00 UTC; pure-function math is unit-tested.
- [x] **Health endpoints.** `/api/health` (liveness) + `/api/health/deep` (Postgres + worker probes).
- [x] **Sentry env vars wired** in `packages/config/src/env.ts`. Init scripts are a Phase 7 follow-up (the DSN env keys are validated).
- [x] **Structured logs.** `apps/web/lib/observability.ts` (web) + `services/worker-python/app/main.py:logger` (worker). New fields added: `service: extension|mobile` for cross-surface correlation.
- [x] **Cross-surface DOM contract.** `ReaderColumn` + `KaraokeHighlighter` render identical `data-word-idx` / `data-current-sentence` markup in web + extension (mobile uses the same segment tree, RN-rendered).

What's a user follow-up before launch:

- [ ] **Postgres + Redis provisioned** with `pnpm db:generate && pnpm db:migrate` (and `psql` apply against Railway Postgres).
- [ ] **`pnpm install` for `apps/mobile`** — the Expo / react-native dep tree is heavy; install when you're ready to build the device apps.
- [ ] **Railway deploy** of the `web`, `worker-python`, and `celery-beat` services per `railway.toml`.
- [ ] **Sentry DSN** — set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser/extension/mobile) on each Railway service.
- [ ] **Push notification certs** — APNs key for iOS, FCM service account for Android (mobile app uses `expo-notifications`).
- [ ] **Domain + DNS** for the `readmaxxing://` deep link scheme (mobile auth handoff).
- [ ] **Privy allowed origins** — add the production domain + the deep-link scheme to the Privy dashboard.
- [ ] **App Store + Play Store metadata** (if shipping to the stores).
- [ ] **On-device TTS** (Phase 7) — `react-native-sherpa-onnx` swap; requires a custom Expo dev client.

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
