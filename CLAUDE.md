# CLAUDE.md — ReadMaxxing

> Claude Code auto-loads this file as persistent project memory. **Read this
> first**, then `AGENTS.md` and the docs it points to. This is the short,
> always-on version; `AGENTS.md` + `docs/` hold the depth. When this file and a
> doc disagree, reconcile it — don't silently pick. **Trust the code over the
> docs** for current state: `docs/IMPLEMENTATION-STATUS.md` + the code are the
> source of truth (the docs occasionally describe an aspirational "complete"
> state). The canonical decision log (`D1–D38`) lives at `docs/CHANGELOG.md`.

## What this is

A Speechify-class voice-AI reading app. Three surfaces — **Next.js web**
(`apps/web`, the primary surface), **Chrome MV3 extension** (`apps/extension`),
**Expo mobile** (`apps/mobile`) — share one document model (`SegmentTree`), one
TTS abstraction (`packages/tts`), one LLM gateway (OpenRouter, `packages/ai`),
and a Postgres-backed position store. Backend is a **FastAPI + Celery** Python
worker (`services/worker-python`). Turborepo + pnpm; Node 20; Python 3.12.

## Read in this order

1. `AGENTS.md` — orientation, reading order, conventions (the full version of this file).
2. `docs/ARCHITECTURE.md` — system of record for *what* exists and how it fits.
3. `docs/CHANGELOG.md` — decision log (`D1–D38`); the *why* behind the code.
4. `docs/IMPLEMENTATION-STATUS.md` — **what is real vs stub** (current-state truth).
5. `docs/DESIGN-SYSTEM.md` + `docs/UI-UX.md §7–§8` — visual law + AI-product rules.
6. `TESTING.md` (repo root) — test + observability spec.
7. `docs/POLISH-BACKLOG.md` — the prioritized, loop-driven work backlog.

## Behavioral rules (override default behavior; explicit user instructions win)

- **Think before coding.** State assumptions; surface tradeoffs; ask when genuinely ambiguous rather than guessing.
- **Simplicity first.** The minimum code that solves the problem. No speculative abstractions, no features beyond what was asked.
- **Surgical changes.** Touch only what the task needs. Match existing style. Don't refactor unrelated code. Remove only the orphans your change creates.
- **Goal-driven.** Turn each task into a verifiable goal with an explicit check, and loop until it's green.
- **One universal data type.** Extend the `SegmentTree` (`packages/core/src/types.ts`) — never introduce a second document model.
- **Cite sources in AI answers.** Every prose AI response must include `[cite:paragraphIndex:sentenceIndex]` tags (UI-UX §7); run them through `validateCitations`.
- **Design law.** CSS variables + Tailwind utilities only — no hard-coded hex, no inline color. Coral is the single hero accent per screen; 20px card radius; Inter only; tabular figures; coral 3px `:focus-visible` ring; respect `prefers-reduced-motion`.
- **No mid-flow interruptions.** No save modals, no upsells, no autoplay-with-sound.

## The gotchas (these cost hours if skipped — full list in `docs/ARCHITECTURE.md §13`)

1. **Prisma engine is NOT in the Next standalone bundle.** After every build, copy `node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client` into `apps/web/.next/standalone/.../node_modules/.prisma/client`, or every DB route 500s with `PrismaClientInitializationError` (D-decision: Prisma engine copy).
2. **`.env` is NOT read by the standalone bundle at runtime.** Copy it into the bundle or set Railway service env vars. **Locally**, `apps/web/next.config.ts` loads the repo-root `.env` for dev/build (so `next dev` finds `DATABASE_URL`).
3. **Tailwind is v3.4.x, NOT v4.** v3 `@tailwind` directives + shared `packages/ui/tailwind.config.ts` + a PostCSS step. Do not "upgrade" to v4.
4. **Importer is open by default (D32/D33).** Don't hide it behind a "show importer" toggle.
5. **`initialThemeFromCookie` is server-safe and lives in `packages/ui/src/themes.ts`** (not `providers.tsx`, which is client-only). SSR sets `[data-theme]` to avoid a flash of the wrong theme.
6. **Speech marks vary by provider.** ElevenLabs/Azure/Google return native word timing; OpenAI returns none; local is estimated. Never assume word timestamps are present — `heuristicSpeechMarks()` is the fallback.
7. **TTS audio is per-device IndexedDB only** — never persist it server-side. The one exception is AI podcast MP3s on the Railway volume (`PODCAST_VOLUME_PATH`).
8. **`File.name` is read-only.** Use `new File([raw], name, { type })` to rename a blob.

## Verify gate (run before claiming done or committing)

```bash
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build
```

- Local runtime needs Docker Postgres + Redis: `docker compose up -d`.
- **"Tests pass" means tests unchanged or strengthened** — never delete or loosen a test to make the gate green.
- A red gate is a full stop, not a speed bump.

## Working conventions

- Strict TypeScript — no `any`, no `@ts-ignore`; fix the type.
- One backlog item per commit; descriptive message; **never force-push or amend** shared history.
- When you make a real architectural decision, append a `docs/CHANGELOG.md` note with the next `D-number` (currently up to D38).
- Honest time estimates on long operations (no fake "2 seconds" when it takes 90).
