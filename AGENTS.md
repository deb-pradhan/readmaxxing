# AGENTS.md — How to work on ReadMaxxing

> Start here. Every AI agent and human should read this file before opening an editor. It tells you what ReadMaxxing is, which docs own which decisions, and the exact reading order to get productive quickly.

---

## 1. What this project is

ReadMaxxing is a Speechify-class voice AI reading app. Users paste text, drop a file, point it at a URL, or scan an image; the app reads it aloud with word-accurate karaoke highlighting, syncs position across devices, summarizes/quizzes/recaps with AI, and can turn any document into a multi-speaker podcast.

Three surfaces share one codebase: a **Next.js web app**, a **Chrome MV3 extension**, and an **Expo/React Native mobile app**. Backend is a **FastAPI + Celery Python worker** on **Railway**. Data lives in **Railway Postgres** with **Railway Redis** for the Celery queue.

---

## 2. Read in this exact order (≈15 min)

1. **`/Users/deb/Personal Projects/ReadMaxxing/docs/ARCHITECTURE.md`** — system overview, monorepo layout, data model, segment tree, TTS layer, LLM layer, worker, deploy, gotchas. **The single most important doc.** Start here.
2. **`/Users/deb/Personal Projects/ReadMaxxing/CHANGELOG.md`** — every decision (D1–D38) is recorded here. Decisions are the "why" behind the code; the architecture doc is the "what."
3. **`/Users/deb/Personal Projects/ReadMaxxing/docs/IMPLEMENTATION-STATUS.md`** — current state of each phase, what's a stub vs what's real.
4. **`/Users/deb/Personal Projects/ReadMaxxing/docs/DESIGN-SYSTEM.md`** — visual design law (tokens, colors, primitives, components, motion). Use this before any UI change.
5. **`/Users/deb/Personal Projects/ReadMaxxing/docs/UI-UX.md`** — AI-product rules: citations on every AI answer, source-cited answers, latency honesty, pressure-without-shame habit styling. Slim pointer doc; defer visuals to DESIGN-SYSTEM.
6. **`/Users/deb/Personal Projects/ReadMaxxing/.cursor/plans/readmaxxing_v1_plan_9ab9b0ad.plan.md`** — the original high-level plan with the 6-phase build. Reference only — the docs above supersede it for current state.

**Don't skip step 1.** Skipping ARCHITECTURE.md means you'll rediscover the gotchas the hard way.

---

## 3. Codebase map (what lives where)

```
apps/
  web/                       Next.js 15 — primary surface (UI-UX.md §–§11)
  extension/                 Chrome MV3 — same primitives, overlay on any page
  mobile/                    Expo/React Native — same primitives, native audio + on-device TTS later
packages/
  core/                      Pure-TS shared logic: SegmentTree, IndexedDB cache, audio engine, karaoke sync, streak engine, XP calculator
  tts/                       TTSProvider interface + ElevenLabs/OpenAI/Azure/Google/Local adapters + router
  ai/                        OpenRouter client + prompt helpers (summary/quiz/recap/ask/filler) — citations enforced
  ui/                        Design system: tokens, themes (light/dark/sepia/eink), primitives, Tailwind config
  db/                        Prisma schema (24 models) + client
  config/                    zod-validated env + constants (speed presets, XP values)
services/
  worker-python/             FastAPI + Celery: parse, ocr, ai, podcast, tts, leaderboard_cron, openrouter mirror
docs/                        DESIGN-SYSTEM, UI-UX, ARCHITECTURE, IMPLEMENTATION-STATUS, TESTING
.cursor/plans/               Original plans (historical, do not edit)
```

**The universal data type** is `SegmentTree` (`packages/core/src/types.ts`). Every feature — TTS chunking, karaoke highlighting, AI summary, quiz, podcast script — consumes this one structure.

---

## 4. The non-obvious gotchas (full list in ARCHITECTURE.md §13)

These will bite you if you don't know them up front:

1. **Prisma engine binary is NOT in the Next.js standalone bundle.** You must copy `node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/` into `apps/web/.next/standalone/.../node_modules/.prisma/client/` after every build. Without it, every DB-touching route 500s.
2. **`.env` is NOT read by the Next.js standalone bundle at runtime.** Copy it into `apps/web/.next/standalone/apps/web/.env` or set env vars on the Railway service.
3. **Tailwind is v3.4.19, not v4.** Earlier audits confused this. The audit history of "v4 with @theme block" was wrong — we use v3 with the `@tailwind base/components/utilities` directives.
4. **`initialThemeFromCookie` lives in `packages/ui/themes`, not `apps/web/providers.tsx`.** The providers file has `"use client"`; SSR layout needs to call a server-safe helper.
5. **Next.js standalone needs `.next/static` + `.next/server` copied in.** Without this, CSS/JS assets 404. There's a deploy-script snippet in ARCHITECTURE.md §13.
6. **`file.name =` is read-only.** Use `new File([raw], name, { type })` for paste-image naming.
7. **Speech marks per provider vary.** ElevenLabs/Azure/Google return native word timestamps; OpenAI does not (needs post-alignment); local sherpa-onnx is estimated. Don't assume all providers return word marks.
8. **TTS audio is per-device only.** Never persist it server-side. The exception: AI podcast episodes (expensive to regenerate) live on the Railway volume at `PODCAST_VOLUME_PATH`.
9. **Importer is open by default** (D32). Don't hide it behind a "Show importer" toggle again.
10. **No mid-flow interruptions.** No save modals, no upsells, no auto-play-with-sound. This is a hard rule.

---

## 5. Common tasks → where to look

| If you want to… | Read this first | Then edit |
|---|---|---|
| Add a new page | `docs/DESIGN-SYSTEM.md` §11 + `apps/web/app/(app)/library/page.tsx` | Create `apps/web/app/(app)/<page>/page.tsx` |
| Add a new UI component | `docs/DESIGN-SYSTEM.md` §11 | Create in `packages/ui/src/primitives/` |
| Add a new TTS provider | `ARCHITECTURE.md` §5 | Implement `packages/tts/src/adapters/<name>.ts` + register in `packages/tts/src/router.ts` |
| Add an AI feature | `docs/UI-UX.md` §7 (citation rule) + `ARCHITECTURE.md` §6 | Build prompt helper in `packages/ai/src/prompts/` + mirror in `services/worker-python/app/tasks/openrouter.py` + route in `apps/web/app/api/ai/` |
| Add a habit layer mechanic | `docs/DESIGN-SYSTEM.md` §11 (StreakRing/LeaderboardTable) + `packages/core/src/habits/` | Extend `streak-engine.ts` + `xp-calculator.ts` + add `Badge.slug` entries |
| Add a new theme | `packages/ui/src/themes.ts` | Extend `ThemeName` type and add the new variant |
| Wire a new API route | `apps/web/app/api/<route>/route.ts` example (any of `tts`, `positions`, `import`) | Same path pattern |
| Add a worker task | `services/worker-python/app/tasks/<task>.py` example | Mirror any existing task (parse, ai, podcast) |
| Debug a Next.js + Prisma 500 | `ARCHITECTURE.md` §13 + check the Prisma engine copy | `cp -R node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client apps/web/.next/standalone/.../node_modules/.prisma/client` |
| Run the app locally | ARCHITECTURE.md §11 + `.env.example` | `docker compose up -d && pnpm install --filter '!@readmaxxing/mobile' && pnpm --filter @readmaxxing/db generate && pnpm --filter @readmaxxing/db db push && pnpm --filter @readmaxxing/web build && cp -R apps/web/.next/{static,server} apps/web/.next/standalone/apps/web/.next/ && cp .env apps/web/.next/standalone/apps/web/.env && cp -R <prisma-engine> apps/web/.next/standalone/.../node_modules/.prisma/client && cd apps/web/.next/standalone/apps/web && PORT=3000 node server.js` |
| Deploy to Railway | ARCHITECTURE.md §12 | Edit `railway.toml` + add Prisma-engine + `.env` post-build steps |

---

## 6. Test expectations

- **Vitest** per workspace. Run with `pnpm -w test`.
- **215 TS tests + 35 Python tests** across 14 packages today (no new code should drop coverage).
- **Tests live next to source** as `*.test.ts(x)` files.
- **Snapshot tests exist for cross-surface DOM contracts** (`packages/ui/src/primitives/cross-surface.test.tsx`).
- Reference `TESTING.md` for the full spec (45 critical logging points, 93 GIVEN/WHEN/THEN test cases across 16 features, observability architecture).

---

## 7. Conventions

- **Strict TypeScript.** No `any`. Use `unknown` for parsed JSON.
- **No `// @ts-ignore`.** Fix the type.
- **CSS variables + Tailwind utilities only.** No inline styles for color, no hard-coded hex.
- **Inter only.** No serif anywhere (we removed Source Serif + Atkinson in the M-Chef reskin).
- **One bright accent per screen as the hero.** Coral for primary CTA; butter/lavender/mint as supporting tags.
- **20px card radius default.** Never mix radii in one component.
- **Tabular figures globally** on `<body>` (already wired).
- **Coral 3px focus ring** (already wired via `:focus-visible`).
- **`prefers-reduced-motion` respected** (already wired).
- **Honest time estimates on long operations.** No fake "2 seconds" when it takes 90.
- **Source-cited AI answers.** Every response that returns prose must include `citations: [{ text, paragraphIndex }]`.

---

## 8. When in doubt

- Open `ARCHITECTURE.md` and grep for the feature name.
- Open `CHANGELOG.md` and grep for the decision ID (D1–D38).
- Open `docs/DESIGN-SYSTEM.md` "Appendix B: When in Doubt" — covers radius, color, hero-number, navigation decisions.
- For AI-product rules (citations, latency, pressure-without-shame), re-read `docs/UI-UX.md` §7 and §8.

---

## 9. Plan files (historical, do not edit)

The original plans live in `.cursor/plans/`. They are records of the planning phase, not the current state. Use `docs/IMPLEMENTATION-STATUS.md` and `CHANGELOG.md` as the source of truth for "what is done" and "why we did it."

---

## 10. TL;DR

- **Read `docs/ARCHITECTURE.md` first.** It's the truth.
- **Trust `CHANGELOG.md` decisions over your assumptions.** D1–D38 are the rules.
- **Visual changes follow `docs/DESIGN-SYSTEM.md`.** Not your taste.
- **AI changes follow `docs/UI-UX.md` §7.** Citations are mandatory.
- **The gotchas in ARCHITECTURE.md §13 will cost you hours if you skip them.** Especially the Prisma engine copy and the `.env` copy.
- **When something doesn't work, check the gotchas before debugging the symptom.**

---

## 11. CLAUDE.md — Behavioral guidelines to reduce common LLM coding mistakes

> Merge with the project-specific instructions above as needed. These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 11.1 Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 11.2 Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 11.3 Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

### 11.4 Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

### How these guidelines interact with ReadMaxxing-specific rules

- **Simplicity First + Segment Tree.** Don't introduce a second document model just because a feature wants different fields. Extend the existing `SegmentTree`.
- **Surgical Changes + DESIGN-SYSTEM.md.** Don't re-tokenize the design system to fix a one-off visual issue. Find the existing token first; if it doesn't fit, propose a new token (and a `CHANGELOG.md` decision entry), but don't ship the change without telling anyone.
- **Goal-Driven + Gotchas.** "Make import work" is a weak goal. "POST `/api/import` returns 201 with a `documentId` that, on subsequent GET `/api/documents`, appears in the list, and the Prisma engine binary is present in the standalone bundle" is a strong goal.
- **Think Before Coding + D-decisions.** If a change seems to contradict a CHANGELOG decision (D1–D38), stop and surface the conflict instead of silently choosing.