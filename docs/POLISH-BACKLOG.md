# Polish Backlog

This file is the working memory for an autonomous polish loop on ReadMaxxing. It catalogs the verified reality of each feature (code over docs), the doc/code mismatches to reconcile, and a sequenced, loopable backlog of fixes.

## Loop rules

- **Work top-down.** Do items in order within the Backlog. Earlier epics (Reconcile-Docs, OSS-Readiness, Fix-Stubs) unblock launch cheaply; do them first.
- **One item per commit.** Each `P-NNN` is a single, self-contained commit. Do not batch.
- **The verify gate.** Before marking any item done, the global gate must be green: `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build`. DB-touching tests require Docker up (`docker compose up -d`). Each item also lists a narrower `Verify:` command — run it, then the gate.
- **Tests stay unchanged or get stronger.** Never weaken, skip, or delete a test to make the gate pass. You may add tests or tighten assertions.
- **Stop on red or ambiguity.** If the gate goes red and the fix is not obvious, or the item is ambiguous, stop and surface it rather than guessing.
- **Flag D-conflicts.** If an item appears to contradict a decision in `docs/CHANGELOG.md` (D1–D38), do not silently override it — note the conflict in the commit and stop for review. Items below carry a `D-conflict:` field; `none` means no known conflict.

> Ground truth: the canonical decision log is `docs/CHANGELOG.md` (complete, D1–D38). `TESTING.md` lives at the **repo root** (not `docs/`). There is **no** root `CHANGELOG.md` (a stale D1–D11 duplicate was removed). Missing for OSS launch: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.env.example`. The reader route moved to `apps/web/app/reader/[docId]/page.tsx` (uncommitted rename).

## Audit — feature reality

| Feature | Status | Evidence | Doc vs code |
| --- | --- | --- | --- |
| Karaoke word/sentence highlighting (visual) | REAL | `packages/ui/src/primitives/KaraokeHighlighter.tsx`, `apps/web/app/reader/[docId]/page.tsx` | matches |
| Time→word sync timeline | REAL | `apps/web/app/reader/[docId]/page.tsx` (wordTimeline, tick) | matches |
| ElevenLabs forced-alignment speech marks | REAL | `apps/web/app/api/tts/route.ts` (alignmentToSpeechMarks) | IMPLEMENTATION-STATUS says /api/tts=501; false |
| Streaming/progressive playback (<1s) | STUB | `apps/web/app/api/tts/route.ts` (single done frame), `apps/web/lib/tts/client.ts` | UI-UX/audio-engine claim first-chunk-play; batch only |
| core/player AudioEngine + KaraokeSync in web | MISSING | zero imports in `apps/web`; only extension uses them | `packages/core/src/player/index.ts` claims web imports it |
| Bionic reading toggle | REAL | `packages/ui/src/primitives/KaraokeHighlighter.tsx` | matches |
| Focus mode (dim paragraphs) | REAL | `packages/ui/src/primitives/KaraokeHighlighter.tsx` | matches |
| Skip-filler auto-seek | PARTIAL | `apps/web/app/reader/[docId]/page.tsx` (char-ratio estimate) | presented as finished; accuracy gap |
| Resume from saved position (read) | REAL | `apps/web/app/reader/[docId]/page.tsx`, `apps/web/app/api/positions/route.ts` | matches |
| Resume position WRITE (reader page) | PARTIAL | `apps/web/app/reader/[docId]/page.tsx` POSTs `userId:"self"` → 401 | IMPLEMENTATION-STATUS lists SSE sync done |
| Click-to-jump on a word | REAL | `packages/ui/src/primitives/KaraokeHighlighter.tsx` | matches |
| Media Session (web reader) | MISSING | `packages/core/src/player/media-session.ts` exists; no web usage | IMPLEMENTATION-STATUS lists as Phase 2 done |
| Auto-scroll active line | PARTIAL | dueling effects: `page.tsx` (word→center) vs `ReaderColumn.tsx` (sentence→start) | matches |
| Selection menu "Listen from here" | PARTIAL | `apps/web/app/reader/[docId]/page.tsx` first-occurrence match | matches |
| ElevenLabs synthesis + marks (/api/tts POST) | REAL | `apps/web/app/api/tts/route.ts`, `packages/tts/src/adapters/elevenlabs.ts` | IMPLEMENTATION-STATUS:28,52,58 say stub/501; false |
| ElevenLabsAdapter.streamSynthesize | PARTIAL | `packages/tts/src/adapters/elevenlabs.ts` real but never called | duplicated dead code vs route copy |
| TTSRouter (provider selection) | PARTIAL | `packages/tts/src/router.ts` complete but never instantiated | matches |
| OpenAI/Azure/Google TTS adapters | STUB | `packages/tts/src/adapters/{openai,azure,google}.ts` throw on synth | docs correct |
| Local/on-device TTS adapter | STUB | `packages/tts/src/adapters/local.ts` throws | docs correct |
| WebSpeech device-voice TTS adapter | MISSING | no SpeechSynthesis TTSProvider | no claim |
| OpenRouter-routed TTS | MISSING | no openrouter in `packages/tts` | no claim |
| Heuristic speech-mark fallback | REAL | `packages/tts/src/speech-marks.ts`, `packages/tts/src/adapters/_tokenize.ts` | only reachable via unused adapter |
| Voice catalog (GET /api/tts) | REAL | `apps/web/app/api/tts/route.ts`, `packages/tts/src/adapters/elevenlabs.ts` | all voices free:false (no free tier) |
| Layered summary generation | REAL | `apps/web/app/api/ai/summary/route.ts`, `packages/ai/src/index.ts` | matches |
| Citation extraction + jump | PARTIAL | `packages/ai/src/index.ts` (flat citations[]), `apps/web/components/ai/SummaryPanel.tsx` | positional mis-mapping |
| Citation enforcement | PARTIAL | `packages/ai/src/index.ts` validateCitations logs only | route docstring implies enforcement |
| Worker /v1/ai/run | PARTIAL | `services/worker-python/app/main.py:205` missing `await` | ARCHITECTURE claims working passthrough |
| Summary cache | PARTIAL | `apps/web/app/api/ai/summary/route.ts` keys only userId+documentId | style ignored |
| Worker /v1/ai/summary | REAL | `services/worker-python/app/main.py`, `app/tasks/ai.py` | IMPLEMENTATION-STATUS:56 says 501; false |
| Quiz generation (POST /api/ai/quiz) | REAL | `apps/web/app/api/ai/quiz/route.ts`, `packages/ai/src/index.ts` | route docstring claims attempt scaffold; false |
| Quiz attempt scoring (PUT) | REAL | `apps/web/app/api/ai/quiz/route.ts` server-side rescore | matches |
| QuizCard UI | REAL | `apps/web/components/ai/QuizCard.tsx` | matches |
| Quiz sourceParagraph accuracy | PARTIAL | ungrounded cites; `apps/web/lib/ai/document-loader.ts` no para numbering | UI-UX implies reliable cites |
| Quiz quota/cost enforcement | MISSING | `recordUsage` write-only; no reader of UsageLedger | no enforcement |
| Quiz → XP/quest integration | MISSING | no link QuizAttempt → XpEvent/Quest | UI-UX §7 promises it |
| Quiz dedup/refetch (GET) | MISSING | no GET on /api/ai/quiz | regenerates+re-bills on reload |
| Recap GET API route | PARTIAL | `apps/web/app/api/ai/recap/route.ts` complete; zero frontend callers | IMPLEMENTATION-STATUS/UI-UX claim Recap card |
| Recap prompt truncation | PARTIAL | `apps/web/app/api/ai/recap/route.ts` passes full doc.text | prompt claims ~500-char window |
| Worker recap task / /v1/ai/recap | PARTIAL | `services/worker-python/app/tasks/ai.py`, `app/main.py` unused by BFF | dispatchAi only hits /v1/ai/run |
| RecapCache model | REAL | `packages/db/prisma/schema.prisma` | route header misstates cache key |
| POST /api/ai/ask grounded streaming | REAL | `apps/web/app/api/ai/ask/route.ts`, `packages/ai/src/index.ts` | matches |
| validateCitations | REAL | `packages/ai/src/index.ts` | matches |
| AskChat component | REAL | `apps/web/components/ai/AskChat.tsx` | matches |
| POST /api/ai/assistant | PARTIAL | `apps/web/app/api/ai/assistant/route.ts` (non-stream=501) | matches |
| Auth on ask/assistant routes | PARTIAL | `apps/web/lib/observability.ts` trusts raw x-user-id | spoofable |
| Ask context-window handling | PARTIAL | `apps/web/lib/ai/document-loader.ts` sends full doc | no truncation |
| Ask answer caching | MISSING | no cache in ask route | worker-bridge comment implies BFF caches |
| Worker-backed ask streaming | STUB | `apps/web/lib/ai/worker-bridge.ts` always in-process | IMPLEMENTATION-STATUS implies worker serves ask |
| Citation anchor bounds validation | MISSING | `packages/ai/src/index.ts` no range check | dead jump buttons possible |
| Podcast list/single/chat | REAL | `apps/web/app/api/ai/podcasts/route.ts`, `[id]/route.ts`, `[id]/chat/route.ts` | matches |
| Podcast create end-to-end | STUB | BFF camelCase vs worker snake_case → 422 (`route.ts`, `app/main.py`) | IMPLEMENTATION-STATUS:121 claims live e2e |
| Podcast audio stream | STUB | cuid vs worker uuid mismatch → 404 (`[id]/stream/route.ts`, `app/tasks/podcast.py`) | docs claim working player |
| Podcast progress SSE | PARTIAL | `[id]/progress/route.ts` cuid vs uuid; in-memory tracker | docstring claims Redis pub/sub |
| Podcast transcript timestamps | PARTIAL | `[id]/transcript/route.ts` char-ratio; discards speech_marks | comment implies real timing |
| Podcast script generation (worker) | REAL | `services/worker-python/app/tasks/podcast.py` | matches |
| Per-line TTS + pydub mastering | PARTIAL | `app/tasks/podcast.py` silent fallback writes non-MP3 | docstring claims 4-byte signature guard (absent) |
| PodcastCreator UI | REAL | `apps/web/components/ai/PodcastCreator.tsx` | rarely seen due to 422 |
| Podcast voice/depth wiring | PARTIAL | `route.ts` accepts voices; UI exposes none | API advertises configurability |
| Streak engine (pure) | REAL | `packages/core/src/habits/streak-engine.ts` (+tests) | matches |
| XP calculator (pure) | REAL | `packages/core/src/habits/xp-calculator.ts` (+tests) | matches |
| GET /api/habits/streak | REAL | `apps/web/app/api/habits/streak/route.ts` | matches |
| POST /api/habits/streak | PARTIAL | `apps/web/app/api/habits/streak/route.ts` never called by app | IMPLEMENTATION-STATUS:149 says shipped e2e |
| GET/POST /api/habits/xp | PARTIAL | `apps/web/app/api/habits/xp/route.ts` no caller awards XP | totalXp always 0 in app |
| GET /api/habits/leaderboard | PARTIAL | `apps/web/app/api/habits/leaderboard/route.ts` | leaks opted-out users; tiers diverge from cron; never reads LeaderboardEntry |
| GET/POST /api/habits/quests | PARTIAL | `apps/web/app/api/habits/quests/route.ts` no progress gate | claim-any-quest exploit |
| GET /api/habits/badges | PARTIAL | `apps/web/app/api/habits/badges/route.ts` read-only | no award logic anywhere |
| Worker leaderboard cron | STUB | `services/worker-python/app/tasks/leaderboard_cron.py` writes non-existent columns/table | docs say wired; would crash |
| Habit UI primitives | PARTIAL | `packages/ui/src/primitives/*` exist; zero imports in `apps/web` | docs list as complete |
| DailyGoal feature | MISSING | `schema.prisma` model; no reads/writes | xp route fakes constant |
| Voice clone wizard UI | PARTIAL | `apps/web/components/voice/VoiceCloneFlow.tsx` record path no-op | CHANGELOG:510 says live e2e |
| POST /api/voice/clone BFF | PARTIAL | `apps/web/app/api/voice/clone/route.ts` solid policy; synthetic consent id | TESTING.md cites wrong path |
| Worker clone_voice (XTTS) | STUB | `services/worker-python/app/tasks/tts.py` returns random id, no training | CHANGELOG frames Phase 5 live |
| Worker /v1/tts/clone auth | PARTIAL | `app/main.py` runs inline; no X-Worker-Token check | route.ts claims Celery enqueue |
| Cloned-voice preview route | MISSING | no `/api/voice/preview/[voiceId]`; referenced 3× | CHANGELOG implies working preview |
| Private cloned-voice resolution (D24) | MISSING | no voice-list query; hardcoded SAMPLE_VOICES | CHANGELOG D24 asserts enforced filter |
| Cloned-voice deletion | MISSING | no delete route or settings UI | consent copy promises it |
| Consent persistence/versioning (D25) | PARTIAL | `schema.prisma` Consent; no `@@unique([userId,kind,version])` | racy synthetic id |
| Image OCR via vision LLM (worker) | REAL | `services/worker-python/app/tasks/ocr.py` | docs claim PaddleOCR/Tesseract |
| /v1/ocr worker endpoint | REAL | `services/worker-python/app/main.py` synchronous | IMPLEMENTATION-STATUS:56 says 501 |
| BFF /api/import/ocr | REAL | `apps/web/app/api/import/ocr/route.ts` | matches |
| Scanned-PDF rejection (415) | REAL | `apps/web/app/api/import/ocr/route.ts` | dead `scanned-pdf` type/branch |
| Client image path | REAL | `apps/web/components/library/ImportDropzone.tsx` | fake page-progress ticker |
| OCR reading-cleanup parity | PARTIAL | OCR route skips `cleanForReading` (vs `apps/web/app/api/import/route.ts`) | `[illegible]` read aloud |
| Worker endpoint auth (X-Worker-Token) | STUB | BFF sends token; `app/main.py` never checks | implied protected; not |
| Per-page confidence (D29) | MISSING | `app/tasks/ocr.py` single LLM self-estimate | D29 says engine per-page scores |
| LLM cleanForReading (import) | REAL | `apps/web/app/api/import/route.ts` | IMPLEMENTATION-STATUS:58 says 501 |
| stripInlineMarkdown | REAL | `apps/web/app/api/import/route.ts` | matches |
| SegmentTree builder (TS) | REAL | `packages/core/src/pipeline/segment-tree.ts` (92 tests) | matches |
| Python parse_document/build_segment_tree | PARTIAL | `services/worker-python/app/tasks/parse.py` drops pre-abbrev text; sha1 vs fnv1a64 | claims TS mirror; diverges |
| Worker /v1/parse | STUB | `services/worker-python/app/main.py` raises 501 | docs correct; import depends on it |
| URL import path | PARTIAL | `apps/web/app/api/import/route.ts` → 502 (parse 501) | route comment claims stub-queue fallback |
| Segment-tree parity tests | PARTIAL | `services/worker-python/tests/test_segment_tree_parity.py` 2 fail | docs call failures "unrelated" |
| Secrets hygiene | REAL | `.env` gitignored; no secrets in tracked files | clean |
| docker-compose dev creds | PARTIAL | `docker-compose.yml` postgres/postgres | undocumented as dev-only |
| CI workflow | PARTIAL | `.github/workflows/ci.yml` no test step; lint `|| true` | weaker than documented gate |
| AGENTS.md decision-log path | PARTIAL | `AGENTS.md` points at removed root CHANGELOG.md | stale path |
| OSS LICENSE | MISSING | no LICENSE; README says "Proprietary" | contradicts OSS goal |
| CONTRIBUTING / CODE_OF_CONDUCT / SECURITY | MISSING | none in tree | onboarding/community gap |
| .env.example | MISSING | not in tree; README/docker-compose reference it | CHANGELOG:1138 claims it exists |
| Design token system | REAL | `packages/ui/src/tokens.ts`, `tailwind.config.ts` | matches |
| Theme presets + SSR | REAL | `packages/ui/src/themes.ts`, `apps/web/app/layout.tsx` | AAA 7:1 claim unverified |
| Hard-coded hex hygiene | PARTIAL | `Button.tsx`, `StreakRing.tsx`, `XPBar.tsx`, `Input.tsx` literals | hover/SVG accents not tokenized |
| E-ink "no accents" rule | PARTIAL | `StreakRing.tsx`, `XPBar.tsx`, primary Button keep accents | not honored |
| Focus ring / focus-visible | REAL | `packages/ui/src/globals.css`, `tailwind.config.ts` | matches |
| Skip-to-content link | MISSING | `.sr-only-focusable` CSS exists; no anchor | DESIGN-SYSTEM §19.2 requires it |
| Live region (karaoke) | REAL | `KaraokeHighlighter.tsx` aria-live | matches |
| Karaoke keyboard nav | PARTIAL | every word `tabIndex=0` → thousands of tab stops | nav intent unmet |
| Reduced-motion handling | REAL | `globals.css`, `reader/[docId]/page.tsx` | component comment overstates own logic |
| Touch-target sizing | REAL | `Button.tsx` h-12 etc. | CTAs 48px vs claimed 52px; chips/toggle <44px |
| Dialog/Tooltip a11y | REAL | `Dialog.tsx`, `Tooltip.tsx` | matches |
| Empty/loading/error states | PARTIAL | library/reader have them; no `error.tsx`/`not-found.tsx`/`loading.tsx` | inconsistent app-wide |
| Performance budget enforcement | STUB | `.size-limit.json` 500KB whole-dir, brotli off | UI-UX §10 promises ≤150KB reader |
| Per-document reading progress | REAL | `PlaybackPosition`, reader page, ContinueShelf | matches |
| Table of Contents nav | MISSING | heading data exists; no TOC component | segment-tree comment implies chapter-skip |
| Bookmarks | MISSING | no model/UI/API | no claim |
| Highlights/annotations (Note) | STUB | `schema.prisma` Note orphaned; no API/UI | IMPLEMENTATION-STATUS:29 lists as complete |
| Shelves/collections | MISSING | tags never written/filtered | no claim |
| Pin/archive document | PARTIAL | `apps/web/app/api/documents/[id]/route.ts` API-only | not exposed in UI |
| Reading typography prefs | PARTIAL | Settings persists; reader never reads them | `font:'serif'` contradicts Inter-only |
| Theme in reader | PARTIAL | global switcher/cookie; reader ignores persisted pref | matches |

## Discrepancies to reconcile

- **No D1–D11 vs D1–D38 gap.** `docs/CHANGELOG.md` is canonical and complete (D1–D38). The old root `CHANGELOG.md` (D1–D11) was removed. Do **not** report this as a gap. `AGENTS.md` still points at the deleted root path — fix that pointer.
- **TESTING.md is at the repo root**, not `docs/TESTING.md`. Several code comments and `TESTING.md:559` (which itself cites the wrong BFF path `voice-clone/route.ts`) need correcting.
- **Missing OSS files**: `LICENSE` (README explicitly says "Proprietary"), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `.env.example` (README + `docker-compose.yml` tell contributors to `cp .env.example .env`, but it does not exist; `CHANGELOG.md:1138` falsely claims it exists).
- **TTS layer claimed stub/501 but is REAL.** `docs/IMPLEMENTATION-STATUS.md:28,52,58` say all adapters throw and `/api/tts` returns 501. The ElevenLabs route + adapter are fully wired. Same false-501 claim for `/api/import` (real importer) and `/v1/ai/summary` / `/v1/ocr` (implemented, synchronous).
- **Streaming "<1s time-to-play" claimed but absent.** `UI-UX.md`, `audio-engine.ts`, and TTS route docstrings promise first-chunk playback; the route batch-synthesizes the whole document and the client awaits one JSON payload.
- **AudioEngine/KaraokeSync claimed REAL in web but MISSING.** `packages/core/src/player/index.ts` says the web app imports the barrel; it does not — the reader reimplements playback with a plain `<audio>` + RAF loop. Same for MediaSessionWrapper (extension-only).
- **Habit layer claimed shipped end-to-end but is a facade.** Pure core is real; no app code calls the POST endpoints, no habit UI is mounted, the worker cron writes non-existent columns/a non-existent `LeaderboardPromotion` table, badges have no award path, quests have no progress gate, leaderboard leaks opted-out users, and BFF vs cron tier thresholds diverge.
- **Voice cloning claimed live end-to-end but is a stub.** `clone_voice` trains nothing (XTTS path commented out), the preview endpoint is referenced 3× but does not exist, D24's ownership filter has no implementing query, and consent copy promises deletion/audio-deletion that are unbuilt. D24 also names `cloneOwnerId` while the schema uses `ownerId`.
- **OCR docs describe PaddleOCR/Tesseract per-page confidence (D29).** OCR was refactored to a single OpenRouter vision call with a scalar self-reported confidence; D29's mechanism no longer exists and must be superseded/annotated.
- **Podcast Phase 4 claimed live e2e but create/stream are broken** by camelCase↔snake_case (422) and cuid↔uuid (404) wiring mismatches; progress docstring claims Redis pub/sub that is in-memory only; a "4-byte MP3 signature guard" is referenced but absent.
- **Worker HTTP surface is unauthenticated.** The BFF sends `X-Worker-Token` on every call; no `/v1/*` endpoint validates it (OCR, clone, podcast, parse). Launch-blocking if the worker is network-reachable.
- **Cross-surface auth is dev-only.** `apps/web/middleware.ts` only reads `x-dev-user-id` and defaults to literal `"dev-user"`; the Privy Bearer token from extension/mobile is never decoded, so all those requests resolve to the dev account.
- **Note model listed as "complete" but orphaned.** `docs/IMPLEMENTATION-STATUS.md:29` should distinguish "schema provisioned" from "feature shipped".
- **Typography prefs persist but do nothing** in the reader; `DEFAULT_PREFS.font='serif'` contradicts the reader's "Inter only, no serif" contract.
- **Perf budget is fictional.** `.size-limit.json` caps the whole `.next/static` at 500KB (brotli off) while `UI-UX.md §10` promises a ≤150KB-gzip reader route, <50KB HTML, LCP<1.0s — none measured.
- **Skip-to-content link** required by `DESIGN-SYSTEM §19.2` is not implemented (only the unused CSS helper exists).
- **Doc path nits**: `IMPLEMENTATION-STATUS.md` references non-existent `packages/ai/src/prompt-helpers` (helpers are in `packages/ai/src/index.ts`); stale reader route `app/(app)/reader`; `.size-limit.json` comment references the old `(reader)/[docId]` route group.

## Backlog

### Reconcile-Docs

- [ ] P-001 — Reconcile IMPLEMENTATION-STATUS.md with the real reader/TTS/import/AI code
  Goal: Remove all stale "501 / not configured / stub" claims for shipped routes and fix paths.
  Acceptance:
    - Doc no longer says `/api/tts`, `/api/import`, `/v1/ai/summary`, or `/v1/ocr` return 501 or throw
    - Reader route path updated from `app/(app)/reader/[docId]` to `app/reader/[docId]`
    - Media Session described as web=not-wired / extension-only; streaming-first-chunk noted as not yet wired in web
    - Distinguishes REAL (ElevenLabs) from STUB (openai/azure/google/local) adapters; `prompt-helpers` reference removed (points to `packages/ai/src/index.ts`)
  Verify: `grep -n '501' docs/IMPLEMENTATION-STATUS.md; grep -n 'app/(app)/reader\|prompt-helpers' docs/IMPLEMENTATION-STATUS.md`
  Files: docs/IMPLEMENTATION-STATUS.md
  Epic: Reconcile-Docs  Priority: P1  D-conflict: none

- [ ] P-002 — Reconcile OCR docs with the vision-LLM reality (remove PaddleOCR/Tesseract)
  Goal: Document OCR as an OpenRouter vision call; supersede/annotate D29.
  Acceptance:
    - IMPLEMENTATION-STATUS.md updated: `ocr_image` is vision-LLM, `/v1/ocr` returns real results synchronously
    - CHANGELOG Phase-5 OCR entry + D29 superseded by a dated entry noting PaddleOCR/Tesseract removal and scalar self-reported confidence
    - No remaining doc references to PaddleOCR/Tesseract for OCR
  Verify: `grep -rin "paddle\|tesseract" docs/ README.md`
  Files: docs/IMPLEMENTATION-STATUS.md, docs/CHANGELOG.md
  Epic: Reconcile-Docs  Priority: P1  D-conflict: D29 (must be superseded/annotated — confidence is no longer per-page engine-derived)

- [ ] P-003 — Reconcile habit-layer docs: stop claiming shipped end-to-end
  Goal: Mark routes-exist-but-uncalled, no UI surface, cron persist non-functional.
  Acceptance:
    - IMPLEMENTATION-STATUS.md no longer states the habit layer "shipped end-to-end" / UI complete without qualification
    - A note documents: POST endpoints uncalled, no progress/profile UI, cron persist writes a non-existent schema
    - `celery_app.py` comment corrected (BFF does NOT read LeaderboardEntry)
  Verify: `grep -n "end-to-end\|streak ring\|leaderboard" docs/IMPLEMENTATION-STATUS.md`
  Files: docs/IMPLEMENTATION-STATUS.md, services/worker-python/app/celery_app.py, apps/web/app/api/habits/leaderboard/route.ts
  Epic: Reconcile-Docs  Priority: P1  D-conflict: none

- [ ] P-004 — Reconcile voice-cloning + podcast Phase-4/5 docs and fix doc paths
  Goal: Describe clone/preview/delete as stub/missing; correct paths and column names.
  Acceptance:
    - CHANGELOG no longer claims Phase 5 voice cloning is "live end-to-end"; clone=stub, preview=missing, delete=missing
    - TESTING.md path corrected to `apps/web/app/api/voice/clone/route.ts`; D24 uses real column `ownerId`
    - Phase 4 podcast section no longer claims live e2e until create/stream verified; Redis-pub/sub and MP3-signature claims removed
  Verify: `grep -rn "voice-clone/route.ts\|cloneOwnerId" docs TESTING.md`
  Files: docs/CHANGELOG.md, docs/IMPLEMENTATION-STATUS.md, TESTING.md
  Epic: Reconcile-Docs  Priority: P1  D-conflict: none

- [ ] P-005 — Reconcile cross-surface-sync + AI docstrings with code
  Goal: Stop overstating SSE/Phase-6 completeness, worker-ask, recap mirrors, and stale comments.
  Acceptance:
    - IMPLEMENTATION-STATUS.md no longer claims SSE position sync / Phase 6 complete while the write path 401s and no client subscribes
    - Docs note ask/assistant stream in-process (worker SSE deferred); recap "mirrors" claim corrected to reflect the JS path is live
    - `apps/mobile/app/doc/[docId].tsx` + `apps/mobile/lib/auth.ts` header comments corrected (speech-mark driving, Bearer acceptance)
    - ARCHITECTURE `/v1/ai/run` and ai/recap route header comment match real behavior
  Verify: `grep -n 'speech marks\|SSE position sync\|prompt-helpers' docs/IMPLEMENTATION-STATUS.md`
  Files: docs/IMPLEMENTATION-STATUS.md, docs/ARCHITECTURE.md, apps/mobile/app/doc/[docId].tsx, apps/mobile/lib/auth.ts
  Epic: Reconcile-Docs  Priority: P2  D-conflict: none

- [ ] P-006 — Fix stale doc references so a cold contributor isn't misdirected
  Goal: Point all decision-log/test links at canonical paths; drop machine-specific absolute paths.
  Acceptance:
    - AGENTS.md no longer points at the removed root CHANGELOG.md; links resolve to docs/CHANGELOG.md
    - Absolute `/Users/deb/Personal Projects/...` paths replaced with repo-relative paths
    - Any link to `docs/TESTING.md` corrected to root `TESTING.md`
  Verify: `! grep -rn 'ReadMaxxing/CHANGELOG.md' AGENTS.md && ! grep -rn 'docs/TESTING.md' . --include='*.md' && test -f docs/CHANGELOG.md && test -f TESTING.md`
  Files: AGENTS.md, README.md, CLAUDE.md
  Epic: Reconcile-Docs  Priority: P2  D-conflict: none

- [ ] P-007 — Reconcile design/a11y/perf claims with shipped reality
  Goal: Make DESIGN-SYSTEM/UI-UX match code or annotate as pending targets.
  Acceptance:
    - §19.2 skip-link claim matches code (after skip link lands) or is marked pending
    - UI-UX §10 budget numbers match the enforced size-limit config or are annotated as targets-not-enforced
    - KaraokeHighlighter reduced-motion comment reflects the global CSS does the work; CTA height claim (52px vs 48px) reconciled
  Verify: `grep -nE "150KB|Skip to main|52px" docs/UI-UX.md docs/DESIGN-SYSTEM.md`
  Files: docs/DESIGN-SYSTEM.md, docs/UI-UX.md, packages/ui/src/primitives/KaraokeHighlighter.tsx
  Epic: Reconcile-Docs  Priority: P2  D-conflict: none

- [ ] P-008 — Fix stale/incorrect quiz route + schema doc comments
  Goal: Make in-code docstrings match stored shapes/behavior.
  Acceptance:
    - `quiz/route.ts` docstring no longer claims an "empty QuizAttempt scaffold" at generation
    - `schema.prisma` Quiz.questions comment matches stored shape `{question,options,correctIndex,explanation,sourceParagraph}`
    - IMPLEMENTATION-STATUS quiz reference points to docs/CHANGELOG.md
  Verify: `grep -n 'scaffold' apps/web/app/api/ai/quiz/route.ts || true`
  Files: apps/web/app/api/ai/quiz/route.ts, packages/db/prisma/schema.prisma, docs/IMPLEMENTATION-STATUS.md
  Epic: Reconcile-Docs  Priority: P2  D-conflict: none

- [ ] P-009 — Reconcile import-pipeline docs and mark the abbreviation parity defect as a real bug
  Goal: Stop calling `/api/import` a 501 and reframe parity failures honestly.
  Acceptance:
    - IMPLEMENTATION-STATUS.md no longer says `/api/import` returns 501
    - Docs note `/v1/parse` is still a stub and URL import depends on it
    - The "pre-existing parity failures" note flags the abbreviation defect as a real correctness bug, not noise
  Verify: `grep -n '501' docs/IMPLEMENTATION-STATUS.md`
  Files: docs/IMPLEMENTATION-STATUS.md
  Epic: Reconcile-Docs  Priority: P3  D-conflict: none

### OSS-Readiness

- [ ] P-010 — Add an OSS LICENSE and reconcile every "proprietary/private" claim
  Goal: Make the repo legally open-source.
  Acceptance:
    - A `LICENSE` file at repo root with a recognized OSI license (maintainer's choice, e.g. MIT/Apache-2.0)
    - README license section rewritten to name that license (no "Proprietary")
    - Root `package.json` gets a `license` field matching LICENSE; GitHub License sidebar detects it
  Verify: `test -f LICENSE && grep -qiE 'MIT|Apache License|GPL' LICENSE && grep -qi 'license' package.json && ! grep -qi 'Proprietary' README.md`
  Files: LICENSE, README.md, package.json
  Epic: OSS-Readiness  Priority: P0  D-conflict: none

- [ ] P-011 — Create a sanitized, committed .env.example
  Goal: Make the documented `cp .env.example .env` setup actually work.
  Acceptance:
    - `.env.example` exists at repo root, tracked by git, NOT gitignored
    - Lists every key in `packages/config/src/env.ts` / current `.env` (DATABASE_URL, NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_WEBHOOK_SECRET, REDIS_URL, WORKER_API_URL, WORKER_API_TOKEN, ELEVENLABS_API_KEY, OPENROUTER_API_KEY, OPENROUTER_DEFAULT_MODEL, OPENAI_API_KEY, ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL, NODE_ENV) with placeholder values + one-line comments
    - Zero real secrets; CHANGELOG:1138 / README references now resolve
  Verify: `git ls-files | grep -q '^.env.example$' && ! git check-ignore -q .env.example && ! grep -qE 'sk-[A-Za-z0-9]{20}' .env.example`
  Files: .env.example, README.md, docs/CHANGELOG.md
  Epic: OSS-Readiness  Priority: P0  D-conflict: none

- [ ] P-012 — Add CONTRIBUTING.md, CODE_OF_CONDUCT.md, and SECURITY.md
  Goal: Satisfy GitHub community standards and document the dev loop.
  Acceptance:
    - CONTRIBUTING.md documents prerequisites (Node>=20.11, pnpm 9.15.4, Docker for Postgres/Redis, Python 3.12 worker), the dev loop, and the verify gate
    - CODE_OF_CONDUCT.md present (e.g. Contributor Covenant) with a real contact
    - SECURITY.md gives a private vulnerability-reporting channel + supported-versions note
  Verify: `test -f CONTRIBUTING.md && test -f CODE_OF_CONDUCT.md && test -f SECURITY.md && grep -qi 'pnpm' CONTRIBUTING.md`
  Files: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
  Epic: OSS-Readiness  Priority: P1  D-conflict: none

- [ ] P-013 — Document OCR/AI/TTS provider requirements (BYO key) in .env.example / README
  Goal: Tell self-hosters which keys and model capabilities are required.
  Acceptance:
    - `.env.example` keys carry comments (OPENROUTER_API_KEY, OPENROUTER_DEFAULT_MODEL must be vision-capable for OCR, ELEVENLABS_API_KEY, WORKER_API_URL/TOKEN)
    - README/docs note OCR is images only (PNG/JPG/WEBP/TIFF, ≤5MB), scanned PDFs unsupported; keys are server-side only and never sent to the client
  Verify: `test -f .env.example && grep -E "OPENROUTER_API_KEY|WORKER_API_TOKEN|OPENROUTER_DEFAULT_MODEL|ELEVENLABS_API_KEY" .env.example`
  Files: .env.example, README.md, docs/IMPLEMENTATION-STATUS.md
  Epic: OSS-Readiness  Priority: P1  D-conflict: none

- [ ] P-014 — Replace dev-header auth with verified Privy session on AI routes
  Goal: Stop trusting unsigned `x-user-id` in production.
  Acceptance:
    - `readUserId` no longer accepts unsigned `x-user-id` when `NODE_ENV==='production'`
    - ask + assistant (and all AI) routes resolve userId from a verified Privy/session token; a forged header returns 401
    - A test asserts a spoofed `x-user-id` for another user's documentId returns 401/404, not the document
    - Dev header path still works behind an explicit DEV flag
  Verify: `pnpm --filter @readmaxxing/web test -- ai/ask && pnpm -w typecheck`
  Files: apps/web/lib/observability.ts, apps/web/app/api/ai/ask/route.ts, apps/web/app/api/ai/assistant/route.ts, apps/web/lib/auth/dev.ts
  Epic: OSS-Readiness  Priority: P0  D-conflict: none

- [ ] P-015 — Label docker-compose dev credentials as local-only
  Goal: Prevent insecure copy-paste of postgres/postgres into production.
  Acceptance:
    - `docker-compose.yml` header/comment states the credentials are for local development only
    - README/CONTRIBUTING note that production DB creds come from the deployment platform env vars
  Verify: `grep -qi 'local' docker-compose.yml && grep -qi 'development only\|dev only\|do not use in production' docker-compose.yml`
  Files: docker-compose.yml, CONTRIBUTING.md
  Epic: OSS-Readiness  Priority: P3  D-conflict: none

### Fix-Stubs

- [ ] P-016 — Enforce X-Worker-Token on all worker /v1/* endpoints
  Goal: Authenticate the worker HTTP surface (OCR, clone, podcast, parse, AI).
  Acceptance:
    - A shared FastAPI dependency validates `X-Worker-Token` against env `WORKER_API_TOKEN` on every mutating `/v1/*` route
    - Missing/incorrect token → 401; valid token → normal response; no insecure default in production (unset token rejects)
    - BFF and worker share the same env var name; an `/api/import/ocr` round-trip still succeeds with a matching token
  Verify: `cd services/worker-python && python -m pytest -q`
  Files: services/worker-python/app/main.py, services/worker-python/app/deps.py, apps/web/app/api/import/ocr/route.ts, .env.example
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-017 — Fix the missing `await` on `acomplete` so the worker /v1/ai/run path works
  Goal: Repair the broken worker AI dispatch masked by in-process fallback.
  Acceptance:
    - `main.py:205` awaits `acomplete` (or calls sync `complete()`)
    - POST `/v1/ai/run` with `WORKER_API_URL` set returns `{text,usage,model}` 200 (no coroutine-unpack error)
    - worker-bridge no longer silently falls back to in-process for summary when the worker is up
  Verify: `cd services/worker-python && python -c "print('await present' if 'await or_client.acomplete' in open('app/main.py').read() else 'STILL BROKEN')"`
  Files: services/worker-python/app/main.py
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-018 — Fix the reader-page position WRITE userId so resume actually persists
  Goal: Stop the hardcoded `"self"` from 401ing the resume POST.
  Acceptance:
    - The reader POSTs `/api/positions` with a userId matching the middleware-injected `x-user-id` (not `"self"`)
    - A POST from the live reader returns 200, not 401; reloading resumes at the last word played
    - A test asserts `body.userId != header userId` is rejected 401 (guards the regression)
  Verify: `pnpm --filter @readmaxxing/web test -- positions && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/reader/[docId]/page.tsx, apps/web/app/api/positions/route.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-019 — Decode the Privy Bearer token in middleware so extension/mobile map to the real user
  Goal: Stop collapsing all extension/mobile traffic to `"dev-user"`.
  Acceptance:
    - middleware (or a route guard) verifies `Authorization: Bearer` via Privy and sets `x-user-id` to the resolved DID
    - Valid Bearer no longer collapses to `"dev-user"`; `lib/privy-verify.ts` exposes a real `verifyAccessToken`
    - Dev header path still works behind an explicit DEV flag
  Verify: `pnpm --filter @readmaxxing/web typecheck && pnpm --filter @readmaxxing/web test`
  Files: apps/web/middleware.ts, apps/web/lib/privy-verify.ts, apps/web/lib/auth/dev.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-020 — Align BFF→worker podcast payload casing so /v1/podcast/run accepts it
  Goal: Fix the 422 that makes every podcast creation fail.
  Acceptance:
    - Worker `PodcastRunRequest` accepts the exact JSON the BFF sends (BFF→snake_case, OR worker `ConfigDict(populate_by_name=True)` + camelCase aliases)
    - POST `/api/ai/podcasts` with `WORKER_API_URL` set returns 201 with `episode.status=='completed'`
    - A new integration test posts the BFF body shape and asserts 200 + completed manifest (not 422)
  Verify: `pnpm --filter @readmaxxing/web test apps/web/app/api/ai/podcasts/route.test.ts && cd services/worker-python && python -m pytest -k podcast`
  Files: apps/web/app/api/ai/podcasts/route.ts, services/worker-python/app/main.py
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-021 — Unify podcast episode id so audio/progress resolve across BFF and worker
  Goal: Fix the cuid↔uuid mismatch that 404s playback and live progress.
  Acceptance:
    - Worker accepts an `episode_id` from the BFF and uses it for the file name, `audio_url_path`, and stage-tracker keys (no self-minted uuid)
    - `/v1/podcast/{id}/audio` resolves the file written for that id; `GET /api/ai/podcasts/[id]/stream` returns 200/206 audio (not 404)
  Verify: `cd services/worker-python && python -m pytest -k 'podcast and (audio or id)' && pnpm --filter @readmaxxing/web test`
  Files: services/worker-python/app/main.py, services/worker-python/app/tasks/podcast.py, apps/web/app/api/ai/podcasts/route.ts, apps/web/app/api/ai/podcasts/[id]/stream/route.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-022 — Make URL import work: implement or stop depending on worker /v1/parse
  Goal: A valid public URL should create a Document, not 502.
  Acceptance:
    - Either `/v1/parse` returns `{text,title}` via server-side fetch+Readability, OR the import route stops depending on it
    - Importing a valid public URL creates a Document and returns 201 with status `parsed`
    - The route header comment about "best-effort / queue a stub parse task" is corrected or made true
  Verify: `pnpm --filter @readmaxxing/web build`
  Files: services/worker-python/app/main.py, apps/web/app/api/import/route.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-023 — Gate quest completion on actual measured progress
  Goal: Close the claim-any-quest exploit.
  Acceptance:
    - POST `/api/habits/quests` recomputes progress from XpEvent and returns 409/400 if progress < target
    - A test asserts a user cannot claim a quest they have not completed
  Verify: `pnpm --filter @readmaxxing/web test -- quests`
  Files: apps/web/app/api/habits/quests/route.ts, apps/web/app/api/habits/quests/route.test.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-024 — Honor other users' leaderboard opt-out (privacy)
  Goal: Stop exposing users who set Consent leaderboards=false.
  Acceptance:
    - Leaderboard rows exclude or anonymize users whose Consent kind='leaderboards' granted=false
    - A test seeds an opted-out user and asserts they are not exposed in another user's rows
  Verify: `pnpm --filter @readmaxxing/web test -- leaderboard`
  Files: apps/web/app/api/habits/leaderboard/route.ts, apps/web/app/api/habits/leaderboard/route.test.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-025 — Wire habit events into the real reading/listening/quiz/import flows
  Goal: Make streaks and XP actually advance in the running app.
  Acceptance:
    - Completing a listen/doc/quiz/podcast triggers POST `/api/habits/xp` and POST `/api/habits/streak`
    - On a milestone day, STREAK_MILESTONE XP is awarded exactly once (idempotent)
    - A test shows totalXp and currentDays advance after a session
  Verify: `grep -rn "habits/xp\|habits/streak" apps/web --include="*.tsx" --include="*.ts" | grep -v ".next/" && pnpm --filter @readmaxxing/web test`
  Files: apps/web/components/reader/ReaderColumn.tsx, apps/web/app/api/positions/route.ts, apps/web/app/api/ai/quiz/route.ts, apps/web/lib/habits/
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-026 — Fix the worker leaderboard cron to write the real schema (or remove it)
  Goal: Stop the cron from crashing on first real DB write.
  Acceptance:
    - `_persist_leaderboard` writes to columns/tables that exist (`LeaderboardLeague` + `LeaderboardEntry` leagueId/xp/rank), or `LeaderboardPromotion` is added to the schema + migrated
    - A test exercises `_persist_leaderboard` against an ephemeral Postgres (no longer monkeypatched away)
    - `determine_tier` thresholds match the BFF tier table or use a single shared source
  Verify: `cd services/worker-python && python -c "import app.tasks.leaderboard_cron as c; print(c.LEAGUE_THRESHOLDS)" && pytest tests/test_leaderboard_cron.py -q`
  Files: services/worker-python/app/tasks/leaderboard_cron.py, services/worker-python/tests/test_leaderboard_cron.py, packages/db/prisma/schema.prisma
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-027 — Guard ask/assistant against oversized documents
  Goal: Stop sending the entire document untruncated on every question.
  Acceptance:
    - `buildAskPrompt` input is bounded to a configurable max char/token budget
    - Docs larger than the budget are windowed/capped instead of sent whole
    - A unit test feeds a >200k-char doc and asserts the prompt stays under budget
  Verify: `pnpm --filter @readmaxxing/ai test && pnpm --filter @readmaxxing/web test`
  Files: apps/web/app/api/ai/ask/route.ts, apps/web/app/api/ai/assistant/route.ts, packages/ai/src/index.ts, apps/web/lib/ai/document-loader.ts
  Epic: Fix-Stubs  Priority: P0  D-conflict: none

- [ ] P-028 — Decide the fate of unused core/player AudioEngine + KaraokeSync in web
  Goal: Remove dead-code ambiguity for the streaming engine in the web path.
  Acceptance:
    - Either the web reader is migrated onto AudioEngine/KaraokeSync, OR they are explicitly marked extension/mobile-only with a code comment + doc note
    - `player/index.ts` barrel comment no longer falsely claims the web app imports it (if kept unused)
  Verify: `grep -rn 'AudioEngine\|KaraokeSync' apps/web/app apps/web/components apps/web/lib`
  Files: packages/core/src/player/index.ts, apps/web/app/reader/[docId]/page.tsx, docs/IMPLEMENTATION-STATUS.md
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-029 — Ground quiz paragraph citations against the SegmentTree
  Goal: Make "Jump to paragraph" land correctly.
  Acceptance:
    - `buildQuizPrompt` receives paragraph-numbered text (or the paragraph count + cite-in-range instruction)
    - route clamps/drops `sourceParagraph >= tree.paragraphs.length`
    - A unit test asserts an out-of-range cite → -1 (no jump) and an in-range cite maps correctly
  Verify: `pnpm --filter @readmaxxing/ai test && pnpm --filter @readmaxxing/web test`
  Files: packages/ai/src/index.ts, apps/web/app/api/ai/quiz/route.ts, apps/web/lib/ai/document-loader.ts, packages/ai/src/index.test.ts
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-030 — Truncate recap source to the window around the anchor
  Goal: Match the prompt's promised window and bound token cost.
  Acceptance:
    - The recap route slices `doc.text` to the anchor paragraph plus ~500–800 chars before calling `buildRecapPrompt`
    - Prompt text + route docstring match the real behavior; a 50k-char doc recap does not include the full document
    - A unit test asserts the prompt input length is bounded for a long document
  Verify: `pnpm -w typecheck && pnpm -w test --filter @readmaxxing/web`
  Files: apps/web/app/api/ai/recap/route.ts, packages/ai/src/index.ts, apps/web/lib/ai/document-loader.ts, packages/ai/src/index.test.ts
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-031 — Resolve the dual recap-prompt / dead-endpoint duplication
  Goal: One canonical recap path; no never-executed implementation.
  Acceptance:
    - Either dispatchAi routes recap to `/v1/ai/recap` (passing anchor indices), OR the unused Python `generate_recap`/`/v1/ai/recap`/`recap_messages` are removed and JS `buildRecapPrompt` documented as canonical
    - No code path references a recap prompt implementation that is never executed
  Verify: `grep -rn "v1/ai/recap\|recap_messages\|generate_recap" services/worker-python apps/web/lib && pnpm -w typecheck`
  Files: apps/web/lib/ai/worker-bridge.ts, services/worker-python/app/tasks/ai.py, services/worker-python/app/tasks/openrouter.py, services/worker-python/app/main.py, docs/IMPLEMENTATION-STATUS.md
  Epic: Fix-Stubs  Priority: P2  D-conflict: none

- [ ] P-032 — Persist worker speech_marks and serve real per-line podcast timestamps
  Goal: Replace the char-ratio transcript heuristic with real marks.
  Acceptance:
    - BFF POST stores `manifest.speech_marks` on the episode when status==completed
    - transcript route derives timeStart/timeEnd from stored marks; `timeEnd[N]==timeStart[N+1]` (no overlap), exactly one active line
  Verify: `pnpm --filter @readmaxxing/web test apps/web/app/api/ai/podcasts`
  Files: apps/web/app/api/ai/podcasts/route.ts, apps/web/app/api/ai/podcasts/[id]/transcript/route.ts, packages/db/prisma/schema.prisma
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-033 — Guard against non-playable stub podcast audio (or remove the dead signature claim)
  Goal: Never stream the ASCII silent-fallback as audio/mpeg.
  Acceptance:
    - Worker validates mastered bytes start with a valid MP3/ID3 frame before writing, OR the stream route checks leading bytes and returns 502 for the fallback (as its docstring promises)
    - On a pydub-less environment the episode is marked failed with a clear message instead of streaming garbage
    - Docstrings in `podcast.py` and `stream/route.ts` match the implemented behavior
  Verify: `cd services/worker-python && python -m pytest -k 'podcast and (silent or fallback)'`
  Files: services/worker-python/app/tasks/podcast.py, apps/web/app/api/ai/podcasts/[id]/stream/route.ts
  Epic: Fix-Stubs  Priority: P2  D-conflict: none

- [ ] P-034 — Make podcast progress survive restarts / multiple workers
  Goal: Replace the in-memory stage dict with shared storage.
  Acceptance:
    - Stage events are published to Redis (pub/sub or TTL list keyed by episode_id), readable by any worker process and the BFF
    - Progress SSE shows live stages for an episode produced by a different worker process; falls back to DB-seeded terminal state when Redis is unavailable
  Verify: `cd services/worker-python && python -m pytest -k 'podcast and progress'`
  Files: services/worker-python/app/tasks/podcast.py, services/worker-python/app/main.py, apps/web/app/api/ai/podcasts/[id]/progress/route.ts
  Epic: Fix-Stubs  Priority: P2  D-conflict: none

- [ ] P-035 — Fix Python abbreviation handling to preserve text before abbreviations
  Goal: Stop dropping "Dr. Smith met Mr. Jones..." in the worker tokenizer.
  Acceptance:
    - `test_abbreviations_do_not_split_sentences` passes
    - Python `build_segment_tree('Dr. Smith met Mr. Jones at 5 p.m. Did they talk? Yes!')` keeps "Dr. Smith met Mr. Jones"; concatenated sentence text covers the full input
  Verify: `cd services/worker-python && python3 -m pytest tests/test_segment_tree_parity.py::test_abbreviations_do_not_split_sentences -q`
  Files: services/worker-python/app/tasks/parse.py
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-036 — Make Python segmentTreeId match the TS fnv1a64 hash
  Goal: Identical ids across runtimes for dedupe/sync.
  Acceptance:
    - Python and TS `build_segment_tree` produce the same `segmentTreeId` for identical input
    - A parity test asserts the known fnv1a64 value for a fixed string; `hashlib.sha1` no longer used for segmentTreeId
  Verify: `cd services/worker-python && python3 -m pytest tests/test_segment_tree_parity.py -q`
  Files: services/worker-python/app/tasks/parse.py, services/worker-python/tests/test_segment_tree_parity.py
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-037 — Run OCR text through the same reading-cleanup as normal import; handle [illegible]
  Goal: Prevent OCR markers/markdown from being read aloud.
  Acceptance:
    - The OCR route builds the SegmentTree from cleaned text (shared `cleanForReading` or equivalent)
    - `[illegible]` tokens are removed or replaced with a non-spoken placeholder; display text and spoken text match for a marker-containing transcription
  Verify: `pnpm --filter @readmaxxing/web test -t ocr && pnpm -w typecheck`
  Files: apps/web/app/api/import/ocr/route.ts, apps/web/app/api/import/route.ts
  Epic: Fix-Stubs  Priority: P1  D-conflict: none

- [ ] P-038 — Implement assistant non-streaming response instead of 501
  Goal: Provide a JSON answer path matching the ask route.
  Acceptance:
    - POST `/api/ai/assistant` with `stream:false` returns `{answer,citations,model}` 200
    - A test asserts non-streaming assistant returns 200 with answer text
  Verify: `pnpm --filter @readmaxxing/web test -- ai/assistant`
  Files: apps/web/app/api/ai/assistant/route.ts
  Epic: Fix-Stubs  Priority: P3  D-conflict: none

- [ ] P-039 — Either wire stub OpenAI/Azure/Google/Local TTS adapters or gate them out of the catalog
  Goal: No user-selectable voice should throw "not configured" on play.
  Acceptance:
    - GET `/api/tts` catalog only lists voices whose provider can actually synthesize, OR the stub adapters are implemented and pass a smoke synth
    - No selectable voice throws "not configured" on play
  Verify: `pnpm --filter @readmaxxing/web test -- route.test`
  Files: apps/web/app/api/tts/route.ts, packages/tts/src/router.ts, packages/tts/src/adapters/index.ts
  Epic: Fix-Stubs  Priority: P2  D-conflict: none

### Pluggable-TTS

- [ ] P-040 — Introduce TTSRouter into the live /api/tts path so providers are pluggable
  Goal: Resolve the provider via the router instead of hardcoding ElevenLabs.
  Acceptance:
    - `/api/tts` resolves the provider via `TTSRouter.synthesize` keyed by voiceId
    - Adding a new adapter needs no edits to route.ts beyond registration; existing ElevenLabs behavior (marks, chunking, 503-on-missing-key) unchanged; route.test.ts passes
  Verify: `pnpm --filter @readmaxxing/web test -- route.test && pnpm -w typecheck`
  Files: apps/web/app/api/tts/route.ts, packages/tts/src/router.ts, packages/tts/src/adapters/index.ts
  Epic: Pluggable-TTS  Priority: P1  D-conflict: none

- [ ] P-041 — Add a WebSpeech (device-voice) TTSProvider as the free/offline tier
  Goal: Give the catalog a real free voice path.
  Acceptance:
    - A `DeviceSpeechAdapter` implements TTSProvider using `window.speechSynthesis`; `getVoices()` maps to `Voice` with `free:true`
    - Reader can select + play a device voice end-to-end with word-boundary marks from `onboundary`
    - Graceful no-op when SpeechSynthesis is unavailable
  Verify: `pnpm --filter @readmaxxing/web build && pnpm -w typecheck`
  Files: packages/tts/src/adapters/device.ts, packages/tts/src/adapters/index.ts, apps/web/lib/tts/client.ts, apps/web/components/reader/ReaderColumn.tsx
  Epic: Pluggable-TTS  Priority: P1  D-conflict: none

- [ ] P-042 — De-duplicate alignment→speech-mark logic (route should reuse the adapter)
  Goal: One canonical `alignmentToSpeechMarks`.
  Acceptance:
    - `alignmentToSpeechMarks` exists in exactly one place (the tts package); route.ts imports it
    - Output marks for a fixed alignment fixture are byte-identical before/after
  Verify: `test "$(grep -rn 'function alignmentToSpeechMarks' apps packages | wc -l | tr -d ' ')" = 1`
  Files: apps/web/app/api/tts/route.ts, packages/tts/src/adapters/elevenlabs.ts, packages/tts/src/speech-marks.ts
  Epic: Pluggable-TTS  Priority: P2  D-conflict: none

- [ ] P-043 — Make /api/tts actually stream the first chunk (or stop claiming it does)
  Goal: Approach the design's time-to-play target, or correct the docstrings.
  Acceptance:
    - Either POST emits one NDJSON line per synthesized chunk (first flushed before later chunks complete) and the client consumes incrementally with per-chunk karaoke marks; OR all "streaming" docstrings in route.ts/provider.ts/elevenlabs.ts/audio-engine.ts are corrected to describe batch synthesis
    - If streaming: a >3-chunk doc yields >1 NDJSON frame and measured time-to-play is materially lower than full-synth
  Verify: `pnpm --filter @readmaxxing/web test -- route.test && pnpm -w typecheck`
  Files: apps/web/app/api/tts/route.ts, apps/web/lib/tts/client.ts, packages/tts/src/provider.ts, apps/web/app/reader/[docId]/page.tsx, packages/core/src/player/audio-engine.ts
  Epic: Pluggable-TTS  Priority: P2  D-conflict: none

- [ ] P-044 — Make extension/mobile TTS consume the real NDJSON contract and default voice
  Goal: Restore audible playback on extension + mobile.
  Acceptance:
    - OverlayPlayer + mobile reader parse the NDJSON audio+marks stream (not `res.blob()` of NDJSON); playback is audible on both
    - Hardcoded `voiceId:'eleven_rachel'` replaced with the real default (Alice `Xb7hH8MSUJpSbSDYk0k2`) or the user's selection; karaoke `currentWordIndex` driven by speech marks, not just tap
  Verify: `pnpm --filter @readmaxxing/extension test && pnpm --filter @readmaxxing/mobile test`
  Files: apps/extension/src/components/OverlayPlayer.tsx, apps/mobile/app/doc/[docId].tsx, apps/web/lib/tts/client.ts
  Epic: Pluggable-TTS  Priority: P1  D-conflict: none

- [ ] P-045 — Decide and document the OpenRouter-routed-TTS path (or remove the implication)
  Goal: Resolve whether TTS routes through OpenRouter.
  Acceptance:
    - A short design note states whether TTS routes through OpenRouter or stays direct-to-provider
    - If pursued, a spike adapter calls an OpenRouter TTS model behind TTSProvider; if not, no docs imply OpenRouter TTS exists
  Verify: `grep -rin "openrouter" packages/tts docs | head`
  Files: docs/IMPLEMENTATION-STATUS.md, packages/tts/src/adapters/
  Epic: Pluggable-TTS  Priority: P3  D-conflict: none

- [ ] P-046 — Wire a real local clone model (or gate the clone feature as experimental/disabled)
  Goal: Stop returning a fake cloned voice when no model is configured.
  Acceptance:
    - With no model configured, the UI surfaces an honest "voice cloning is not available in this deployment" state (no fake cloned voice)
    - If enabled (XTTS_MODEL_PATH set), `clone_voice` produces and persists a usable voice artifact + working preview
    - README/docs state the model requirement and how to enable it
  Verify: `cd services/worker-python && python -m pytest -q`
  Files: services/worker-python/app/tasks/tts.py, apps/web/components/voice/VoiceCloneFlow.tsx, README.md
  Epic: Pluggable-TTS  Priority: P2  D-conflict: none

### BYO-Keys

- [ ] P-047 — Add BYO LLM/TTS API-key fields to the data model with encrypted-at-rest storage
  Goal: Per-user secrets, never plaintext, never returned.
  Acceptance:
    - A new encrypted table (e.g. `UserSecret { userId, provider, ciphertext, iv, createdAt }`) added to schema — NOT the plaintext `UserPreference.prefs` JSON
    - An AES-256-GCM envelope helper keyed by a new `ENCRYPTION_KEY` server env encrypts on write, decrypts on read
    - Plaintext key never written/returned (only a masked suffix + `isSet`); prisma migration generated
  Verify: `pnpm --filter @readmaxxing/db exec prisma validate && pnpm -w typecheck`
  Files: packages/db/prisma/schema.prisma, packages/config/src/env.ts, packages/db/src/secrets.ts
  Epic: BYO-Keys  Priority: P1  D-conflict: none (extends D1; OpenRouter stays default gateway, per-user key is an override)

- [ ] P-048 — Add an API-keys settings section + secure write/delete endpoint
  Goal: Let self-hosters supply keys via UI without leaking them.
  Acceptance:
    - New POST/DELETE `/api/user/secrets` validates provider enum, encrypts via the helper, requires auth
    - GET returns only `{provider, isSet, maskedSuffix}` — never the raw key
    - Settings gains an "API keys (advanced)" section with password inputs, masked display, remove button; server logs provider + user_id_hash only
  Verify: `pnpm --filter @readmaxxing/web test -- secrets && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/api/user/secrets/route.ts, apps/web/app/(app)/settings/page.tsx, apps/web/app/api/user/secrets/route.test.ts
  Epic: BYO-Keys  Priority: P1  D-conflict: none

- [ ] P-049 — Thread per-user key override through the LLM + TTS call paths
  Goal: Use the user's key when present; env fallback otherwise.
  Acceptance:
    - `getApiKey()` accepts an optional override and falls back to `process.env`; completion entrypoints accept a resolved key
    - TTS route resolves the user's decrypted ElevenLabs key first, env second; a mocked-fetch test inspects the outgoing key header
    - No key value appears in any log line or client-returned error
  Verify: `pnpm --filter @readmaxxing/ai test && pnpm --filter @readmaxxing/web test -- tts`
  Files: packages/ai/src/index.ts, apps/web/app/api/tts/route.ts, apps/web/app/api/import/route.ts
  Epic: BYO-Keys  Priority: P1  D-conflict: none (honors D1 OpenRouter-first; env key remains default)

- [ ] P-050 — Add BYO-key/503 coverage and document the no-key behavior
  Goal: Self-hosters without a key get an actionable 503; large pastes still import.
  Acceptance:
    - Missing-key path returns the existing 503 `no_provider_key` with an actionable message, covered by a test
    - With no `OPENROUTER_API_KEY`, large pastes still import via the deterministic strip path; the LLM-vs-raw difference is documented
    - README/SECURITY note keys are server-side only, never sent to the client
  Verify: `pnpm --filter @readmaxxing/web build && pnpm --filter @readmaxxing/web test -- tts`
  Files: .env.example, README.md, apps/web/app/api/tts/route.ts, apps/web/app/api/import/route.ts
  Epic: BYO-Keys  Priority: P1  D-conflict: none

- [ ] P-051 — Enforce a per-user AI quota using UsageLedger before generation
  Goal: Cap free-tier AI usage so quizzes/summaries don't re-bill uncapped.
  Acceptance:
    - A shared `checkQuota(userId, action)` reads summed UsageLedger usage for the period and returns remaining allowance
    - AI generation routes return 429 `quota_exceeded` when the cap is hit; cap is configurable via env/config
    - Tests cover under-limit (201) and over-limit (429)
  Verify: `pnpm --filter @readmaxxing/web test --run quiz && pnpm -w typecheck`
  Files: apps/web/lib/ai/document-loader.ts, apps/web/app/api/ai/quiz/route.ts, packages/config/src/constants.ts
  Epic: BYO-Keys  Priority: P1  D-conflict: none

### Ebook-Reader

- [ ] P-052 — Apply persisted typography prefs to the reading surface
  Goal: Make Settings (fontSize/lineSpacing/measure) actually change the reader.
  Acceptance:
    - Reader fetches `/api/user/preferences` on load and applies fontSize, lineSpacing, measure as inline CSS vars on the reading column
    - Changing Body size / Line spacing / Measure in Settings visibly changes the reader after reload
    - KaraokeHighlighter no longer hardcodes `text-[1.0625rem]/leading-[1.85]`; uses pref-driven values with current values as fallbacks
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/reader/[docId]/page.tsx, packages/ui/src/primitives/KaraokeHighlighter.tsx, packages/ui/src/primitives/ReaderColumn.tsx, apps/web/app/api/user/preferences/route.ts
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-053 — Resolve the serif-vs-Inter font contradiction
  Goal: Either remove the dead font pref or implement real font-family switching.
  Acceptance:
    - `DEFAULT_PREFS.font` no longer defaults to 'serif' while the reader claims Inter-only, OR a font-family switch is implemented and applied
    - If kept, the font pref demonstrably changes the rendered font-family; if removed, the Settings control and DEFAULT_PREFS.font are deleted together
    - Reader header comment + DESIGN-SYSTEM agree with shipped behavior
  Verify: `pnpm -w typecheck && pnpm -w lint && grep -rn "font:" apps/web/app/api/user/preferences/route.ts`
  Files: apps/web/app/api/user/preferences/route.ts, apps/web/app/(app)/settings/page.tsx, apps/web/app/reader/[docId]/page.tsx, packages/ui/src/fonts.ts
  Epic: Ebook-Reader  Priority: P2  D-conflict: none

- [ ] P-054 — Build a Table of Contents panel from existing headingLevel data
  Goal: Chapter navigation using data that already exists.
  Acceptance:
    - A TOC component lists all paragraphs with headingLevel>=1 in order, indented by level
    - Clicking an entry scrolls the reader to that paragraph (reuse `data-paragraph-index` + scrollIntoView)
    - TOC is reachable from the reader toolbar and empty-stated when the doc has no headings; active-heading updates on scroll
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/components/reader/TableOfContents.tsx, apps/web/app/reader/[docId]/page.tsx, packages/core/src/pipeline/segment-tree.ts
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-055 — Implement highlights/notes end-to-end on the orphaned Note model
  Goal: Make the Note schema a real feature (API + UI + render).
  Acceptance:
    - New `/api/notes` route supports POST (anchor + text), GET (list per doc), DELETE
    - SelectionMenu gains a "Highlight / Save note" action anchored to the selected words
    - Saved highlights re-render as a soft background span on reload; a notes panel lists annotations and jumps to each
    - A unit test covers the anchor round-trip (selection → anchor → re-resolve to same words)
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/api/notes/route.ts, apps/web/components/reader/SelectionMenu.tsx, apps/web/app/reader/[docId]/page.tsx, packages/ui/src/primitives/KaraokeHighlighter.tsx, packages/db/prisma/schema.prisma
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-056 — Wire the recap into the reader/library so the backend route is reachable
  Goal: Surface the built-but-uncalled recap.
  Acceptance:
    - A RecapCard (or resume banner) fetches `GET /api/ai/recap?documentId=…` for in-progress docs
    - Renders the recap, a loading state, a 502 retry state, and is dismissible; `no_position` ({recap:null}) shows no card
    - `grep` for `ai/recap` in apps/web returns at least one caller outside the route file
  Verify: `grep -rn "ai/recap" apps/web/components apps/web/app | grep -v 'api/ai/recap/route' && pnpm --filter @readmaxxing/web build`
  Files: apps/web/components/library/ContinueShelf.tsx, apps/web/components/reader/ReaderColumn.tsx, apps/web/app/reader/[docId]/page.tsx, packages/ui/src/primitives/Card.tsx
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-057 — Build the progress/profile page that renders the habit UI primitives
  Goal: Give the habit layer a UI surface.
  Acceptance:
    - A route (e.g. `/progress`) imports StreakRing, StreakCalendar, XPBar, LeaderboardTable, BadgeGrid, QuestList and fetches the habit GET endpoints
    - Page renders with real data for a seeded user and is reachable from AppHeader nav
  Verify: `grep -rn "StreakRing\|LeaderboardTable\|BadgeGrid" apps/web/app --include="*.tsx" | grep -v ".next/" && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/progress/page.tsx, apps/web/components/shared/AppHeader.tsx, packages/ui/src/primitives/index.ts
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-058 — Implement GET /api/voices enforcing D24 ownership; load picker from it
  Goal: Make cloned voices survive reload and enforce per-user privacy.
  Acceptance:
    - Endpoint returns Voice rows where `isCloned=false OR ownerId=currentUserId`; another user's clone is never returned (two-user test)
    - `voice/page.tsx` loads from this endpoint instead of hardcoded SAMPLE_VOICES; 401 without a user id
  Verify: `pnpm --filter @readmaxxing/web test -- voices && pnpm --filter @readmaxxing/web typecheck`
  Files: apps/web/app/api/voices/route.ts, apps/web/app/(app)/voice/page.tsx
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-059 — Implement /api/voice/preview/[voiceId] (or remove the preview UI)
  Goal: Stop the 404 on every preview click.
  Acceptance:
    - GET `/api/voice/preview/[voiceId]` returns audio (or a clear disabled state) instead of 404; a user can only preview a clone they own or a marquee voice
    - If preview cannot be backed yet, DoneStep + `voice/page.tsx onPreview` no longer render a broken player; worker `preview_url` points at the implemented route or is null
  Verify: `pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/api/voice/preview/[voiceId]/route.ts, apps/web/components/voice/VoiceCloneFlow.tsx, apps/web/app/(app)/voice/page.tsx, services/worker-python/app/tasks/tts.py
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-060 — Stop the consent screen promising capabilities that don't exist
  Goal: Make consent copy truthful for the current stub.
  Acceptance:
    - Consent copy no longer asserts the sample is "deleted once the voice is trained" unless deletion is implemented
    - Consent copy does not promise "Settings → Voice" deletion until that route exists (or it ships); copy accurately states what the stub does with the sample
  Verify: `pnpm --filter @readmaxxing/web test -- VoiceCloneFlow`
  Files: apps/web/components/voice/VoiceCloneFlow.tsx
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

- [ ] P-061 — Add cloned-voice deletion: DELETE /api/voice/[voiceId] + Settings entry
  Goal: Honor the consent deletion promise.
  Acceptance:
    - DELETE removes the Voice row only if `ownerId === currentUserId`, else 403/404; associated artifacts removed when a real model lands
    - A UI affordance triggers deletion; tests cover owner-deletes-own (200) and non-owner (403)
  Verify: `pnpm --filter @readmaxxing/web test -- voice`
  Files: apps/web/app/api/voice/[voiceId]/route.ts, apps/web/app/(app)/settings/page.tsx
  Epic: Ebook-Reader  Priority: P2  D-conflict: none

- [ ] P-062 — Expose pin + archive controls in the library
  Goal: Surface the already-wired PATCH backend.
  Acceptance:
    - DocCard has a pin toggle and an archive action calling PATCH `/api/documents/[id]` with `{pinned}/{archived}`
    - Library shows pinned docs first (or a Pinned section) and an Archive filter; archiving removes a doc from the default view
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/components/library/DocCard.tsx, apps/web/app/(app)/library/page.tsx, apps/web/app/api/documents/[id]/route.ts
  Epic: Ebook-Reader  Priority: P2  D-conflict: none

- [ ] P-063 — Add bookmarks (named saved positions)
  Goal: Let users save/name/jump-to arbitrary positions distinct from auto-resume.
  Acceptance:
    - User can save a bookmark at the current word; it stores documentId + wordOffset + optional label and persists across reloads/devices
    - A bookmarks panel lists them and jumps to the exact word (reuse `seekTimeForWordIndex`); deleting removes it from list + DB
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/api/bookmarks/route.ts, apps/web/components/reader/Bookmarks.tsx, apps/web/app/reader/[docId]/page.tsx, packages/db/prisma/schema.prisma
  Epic: Ebook-Reader  Priority: P2  D-conflict: none

- [ ] P-064 — Add shelves/collections using the existing Document.tags array
  Goal: Tag-based grouping/filtering in the library.
  Acceptance:
    - Library can group/filter by tag (Document.tags read + rendered as filter chips); user can add/remove tags via PATCH `/api/documents/[id]`
    - A doc with no tags still appears under "All"; empty tags filter handled
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/(app)/library/page.tsx, apps/web/components/library/DocCard.tsx, apps/web/app/api/documents/[id]/route.ts
  Epic: Ebook-Reader  Priority: P3  D-conflict: none

- [ ] P-065 — Make extension + mobile WRITE playback positions (bidirectional resume)
  Goal: Let extension/mobile playback contribute to cross-device resume.
  Acceptance:
    - OverlayPlayer (extension) and mobile reader POST `/api/positions` on a debounced word-advance
    - A doc played to word N in the extension resumes at ~N on web; mobile playback updates the web ContinueShelf
  Verify: `pnpm --filter @readmaxxing/extension test && pnpm --filter @readmaxxing/mobile test`
  Files: apps/extension/src/components/OverlayPlayer.tsx, apps/mobile/app/doc/[docId].tsx, packages/core/src/sync/position-store.ts
  Epic: Ebook-Reader  Priority: P1  D-conflict: none

### Polish

- [ ] P-066 — Fix the dueling auto-scroll in the reader
  Goal: One source of truth for keeping the active line in view.
  Acceptance:
    - Only one scrollIntoView path runs per word/sentence change; active word/sentence stays in a stable band with no double-scroll/jitter
    - `prefers-reduced-motion` still collapses to instant scroll
  Verify: `pnpm -w typecheck && pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/reader/[docId]/page.tsx, apps/web/components/reader/ReaderColumn.tsx
  Epic: Polish  Priority: P1  D-conflict: none

- [ ] P-067 — Make skip-filler seek to the real mark-derived time
  Goal: Replace the char-ratio estimate with the word marks.
  Acceptance:
    - `nextNonFillerStartTime` resolves the target sentence's first word via the same word marks the reader uses
    - Skipping a filler sentence lands within ~0.3s of the next non-filler word's actual audio time; covered by a test on a known mark set
  Verify: `pnpm -w test`
  Files: apps/web/app/reader/[docId]/page.tsx
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-068 — Make "Listen from here" jump to the selection's position
  Goal: Stop jumping to the first global occurrence of a matching word.
  Acceptance:
    - Selecting text seeks to the audio time of the SELECTED occurrence; common words ('the') no longer jump to doc start
    - Uses DOM selection → nearest `data-word-idx` span to resolve the index
  Verify: `pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/reader/[docId]/page.tsx, apps/web/components/reader/SelectionMenu.tsx
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-069 — Wire Media Session in the web reader
  Goal: Background / lock-screen / media-key control.
  Acceptance:
    - `navigator.mediaSession` metadata (title) set on load; play/pause/seekforward/seekbackward (15s) handlers wired to the reader's audio element
    - `playbackState` reflects playing/paused; degrades silently where unsupported; reuses `packages/core` MediaSessionWrapper
  Verify: `pnpm --filter @readmaxxing/web build && grep -rn 'MediaSessionWrapper' apps/web/app/reader`
  Files: apps/web/app/reader/[docId]/page.tsx, packages/core/src/player/media-session.ts
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-070 — Make citation pairing reliable instead of positional guesswork (summary)
  Goal: Pair each bullet with its own citation.
  Acceptance:
    - `parseSummary` returns citations associated with their section (tldr/bullets[i]/detailed), not one flat array
    - SummaryPanel renders the citation belonging to each bullet; a unit test covers bullet count != citation count with no mis-mapping
  Verify: `pnpm --filter @readmaxxing/ai test && pnpm --filter @readmaxxing/web test -- SummaryPanel`
  Files: packages/ai/src/index.ts, apps/web/components/ai/SummaryPanel.tsx, packages/ai/src/index.test.ts
  Epic: Polish  Priority: P1  D-conflict: none

- [ ] P-071 — Enforce citations on summaries (retry-or-flag) and validate anchor bounds (ask)
  Goal: Stop returning silently-uncited prose; drop out-of-range jump buttons.
  Acceptance:
    - When `validateCitations.missing` is true, the summary route retries once with a stricter prompt or returns flagged-as-uncited; SummaryPanel shows an "unverified" affordance for empty citations on substantive prose
    - `validateCitations`/route drops/flags anchors whose paragraph/sentence indices are out of range; AskChat only renders jump buttons for in-range anchors; a `[cite:999:0]` on a 3-paragraph doc is filtered
  Verify: `pnpm --filter @readmaxxing/ai test && pnpm --filter @readmaxxing/web test -- summary AskChat`
  Files: apps/web/app/api/ai/summary/route.ts, apps/web/components/ai/SummaryPanel.tsx, packages/ai/src/index.ts, apps/web/components/ai/AskChat.tsx
  Epic: Polish  Priority: P1  D-conflict: none

- [ ] P-072 — Honor summary style in cache + request
  Goal: Stop serving the default style when the user picks academic/casual.
  Acceptance:
    - Summary cache lookup includes style; SummaryPanel sends style/force when style changes
    - Changing style produces a distinct cached row and a distinct summary
  Verify: `pnpm --filter @readmaxxing/web build && pnpm --filter @readmaxxing/web test -- summary`
  Files: apps/web/app/api/ai/summary/route.ts, apps/web/components/ai/SummaryPanel.tsx, packages/db/prisma/schema.prisma
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-073 — Add a GET /api/ai/quiz so reloads reuse the persisted quiz
  Goal: Stop regenerating + re-billing on every cold mount.
  Acceptance:
    - GET `/api/ai/quiz?documentId=` returns the most recent Quiz for the user/doc or 404
    - QuizCard tries GET first and only POSTs on "New quiz" or when none exists; UsageLedger shows no new row on a reuse reload
    - route test covers GET hit, miss, and ownership scoping
  Verify: `pnpm --filter @readmaxxing/web test --run quiz`
  Files: apps/web/app/api/ai/quiz/route.ts, apps/web/components/ai/QuizCard.tsx
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-074 — Award XP / fire quest progress on a completed QuizAttempt
  Goal: Make the comprehension-habit copy real.
  Acceptance:
    - PUT `/api/ai/quiz` creates an XpEvent (variable bonus per UI-UX §7) and advances any "Take N quizzes" quest; idempotent per attempt
    - QuizCard success copy reflects real awarded XP; a test asserts the XpEvent row on submit
  Verify: `pnpm --filter @readmaxxing/web test --run quiz`
  Files: apps/web/app/api/ai/quiz/route.ts, packages/core/src/habits/xp-calculator.ts, packages/db/prisma/schema.prisma
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-075 — Implement badge award logic (UserBadge inserts)
  Goal: Let badges actually be earned, not just displayed.
  Acceptance:
    - A code path inserts UserBadge (with required `tierAtAward`) when a user crosses a criterion (e.g. 14-day streak); idempotent via `@@unique([userId,badgeId])`
    - A test asserts a 14-day streak awards two-week-warrior exactly once
  Verify: `pnpm --filter @readmaxxing/web test -- badges`
  Files: apps/web/app/api/habits/badges/route.ts, apps/web/app/api/habits/streak/route.ts, apps/web/lib/habits/
  Epic: Polish  Priority: P1  D-conflict: none

- [ ] P-076 — Unify leaderboard tier thresholds between BFF and worker
  Goal: One source of truth for tier cutoffs.
  Acceptance:
    - A single threshold table (e.g. `packages/config`) consumed by both the BFF leaderboard route and the Python cron
    - BFF TIERS and Python LEAGUE_THRESHOLDS no longer diverge
  Verify: `grep -n "minXp\|LEAGUE_THRESHOLDS" apps/web/app/api/habits/leaderboard/route.ts services/worker-python/app/tasks/leaderboard_cron.py`
  Files: apps/web/app/api/habits/leaderboard/route.ts, services/worker-python/app/tasks/leaderboard_cron.py, packages/config/src/constants.ts
  Epic: Polish  Priority: P1  D-conflict: none

- [ ] P-077 — Expose voice + depth selection in PodcastCreator and forward them
  Goal: Honor user-chosen voices/depth instead of always defaulting.
  Acceptance:
    - CreatorForm renders host/guest VoicePickers + a depth control (brief/normal/deep); the POST payload includes them and the worker honors them
    - BFF and worker share one set of default voice ids (no `eleven_rachel`/`elevenlabs_josh` vs Alice mismatch)
  Verify: `pnpm --filter @readmaxxing/web test apps/web/components/ai/PodcastCreator.test.tsx`
  Files: apps/web/components/ai/PodcastCreator.tsx, apps/web/app/api/ai/podcasts/route.ts, services/worker-python/app/main.py, services/worker-python/app/tasks/podcast.py
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-078 — Add response caching for ask to cut cost/latency on repeated questions
  Goal: Avoid re-sending the full doc + question for identical queries.
  Acceptance:
    - Identical `(documentId, normalized question)` within a TTL returns a cached answer without a new model call (cached answers still emit citations)
    - Metering does not double-count cache hits
  Verify: `pnpm --filter @readmaxxing/web test -- ai/ask`
  Files: apps/web/app/api/ai/ask/route.ts, apps/web/lib/ai/
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-079 — Fix Cache-Control on /api/tts POST (body-varying response)
  Goal: Never serve stale audio for a different text/voice/speed.
  Acceptance:
    - POST response no longer sends `Cache-Control: private, max-age=86400` (or it is correctly keyed/Vary'd)
    - Client IndexedDB cache remains the source of reuse
  Verify: `grep -n "Cache-Control" apps/web/app/api/tts/route.ts`
  Files: apps/web/app/api/tts/route.ts
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-080 — Derive voice-clone sample duration from real audio, not byte-size
  Goal: Stop a 10kB junk file passing the 10s gate.
  Acceptance:
    - `estimateSeconds` replaced with actual decoded duration (Web Audio `decodeAudioData`); worker computes duration from a header probe instead of bytes math
    - A 10kB junk file no longer passes the 10s gate; UI and worker agree within tolerance
  Verify: `cd services/worker-python && python -m pytest -q && pnpm --filter @readmaxxing/web test -- VoiceCloneFlow`
  Files: apps/web/components/voice/VoiceCloneFlow.tsx, services/worker-python/app/tasks/tts.py
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-081 — Add a real unique constraint for consent idempotency
  Goal: Drop the synthetic-id race workaround.
  Acceptance:
    - schema Consent gains `@@unique([userId, kind, version])`; `consent.upsert` uses the compound where-clause instead of the string id
    - Prisma migration generated; re-submitting the same consent does not create a duplicate (Docker DB test)
  Verify: `pnpm --filter @readmaxxing/db exec prisma validate && pnpm --filter @readmaxxing/web test -- voice/clone`
  Files: packages/db/prisma/schema.prisma, apps/web/app/api/voice/clone/route.ts
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-082 — Replace alert() stubs in settings (Log out, Download my data)
  Goal: Real handlers for primary actions.
  Acceptance:
    - "Log out" calls the actual Privy/auth provider logout; "Download my data" either implements a real export or is removed/feature-flagged (not an alert)
    - No `alert()` remains as a primary action in the settings page
  Verify: `! grep -n 'alert(' "apps/web/app/(app)/settings/page.tsx" && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/(app)/settings/page.tsx, apps/web/app/providers.tsx
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-083 — Fix settings defaults + missing-field drift between page and API
  Goal: Reconcile defaults and make every validated key settable.
  Acceptance:
    - page.tsx DEFAULTS fontSize/lineSpacing match route DEFAULT_PREFS (18 / 1.6), or both reconciled to one value
    - page exposes controls for all PutBody-validated keys (e.g. `font`, `dyslexiaShortcut`), or unused keys are removed from PutBody/DEFAULT_PREFS
  Verify: `pnpm --filter @readmaxxing/web typecheck && pnpm --filter @readmaxxing/web build`
  Files: apps/web/app/(app)/settings/page.tsx, apps/web/app/api/user/preferences/route.ts
  Epic: Polish  Priority: P2  D-conflict: none

- [ ] P-084 — Remove dead OCR 'scanned-pdf' code and make scan progress honest
  Goal: Clean the unreachable pdf branch and the fake page ticker.
  Acceptance:
    - The `scanned-pdf` literal and the `file.name.endsWith('.pdf')` branch in submitOcr are removed (no path posts a pdf field to the 415 route), OR a real scanned-PDF flow is implemented
    - The "Scanning N/M pages" ticker is replaced with a determinate single-image state (no fake `setInterval` targeting total=1)
  Verify: `grep -n "scanned-pdf\|endsWith(\".pdf\")\|setInterval" apps/web/components/library/ImportDropzone.tsx; pnpm -w lint`
  Files: apps/web/components/library/ImportDropzone.tsx
  Epic: Polish  Priority: P3  D-conflict: none

- [ ] P-085 — Fix recap route header comment and cryptoRandomId misnomer
  Goal: Truthful cache-key doc + real id generation.
  Acceptance:
    - Route header describes the real cache key (userId, documentId, anchorWordOffset) and 1h TTL
    - `cryptoRandomId` renamed/reimplemented to use `crypto.randomUUID()`, or the explicit id is dropped to let schema `cuid()` apply; no cache regression
  Verify: `pnpm -w typecheck && pnpm -w lint`
  Files: apps/web/app/api/ai/recap/route.ts
  Epic: Polish  Priority: P3  D-conflict: none

### A11y-Perf

- [ ] P-086 — Make the perf budget enforce the reader route ≤150KB gzip
  Goal: Replace the 500KB whole-dir cap with a real per-route gate.
  Acceptance:
    - `.size-limit.json` has a dedicated entry targeting the reader chunk(s) with limit `150 KB` and gzip enabled, plus a first-load JS cap for the shell
    - `pnpm perf:check` passes against a real next build and fails if the reader bundle exceeds 150KB; the `_comment` no longer contradicts the path/limit (and references the new `app/reader` path)
  Verify: `pnpm --filter @readmaxxing/web build && pnpm perf:check`
  Files: .size-limit.json, package.json
  Epic: A11y-Perf  Priority: P1  D-conflict: none

- [ ] P-087 — Add a "Skip to main content" link on every page
  Goal: Implement the DESIGN-SYSTEM §19.2 requirement using the existing CSS helper.
  Acceptance:
    - A skip link using `.sr-only-focusable` is the first Tab stop in the layout/AppHeader and targets a `#main` landmark
    - Each route's primary `<main>` has `id="main"`; the link is visible on focus
  Verify: `pnpm --filter @readmaxxing/web build && grep -rn "Skip to main" apps/web/app`
  Files: apps/web/app/layout.tsx, apps/web/components/shared/AppHeader.tsx, apps/web/app/(app)/library/page.tsx, apps/web/app/reader/[docId]/page.tsx
  Epic: A11y-Perf  Priority: P1  D-conflict: none

- [ ] P-088 — Fix reader keyboard navigation: stop making every word a tab stop
  Goal: Avoid thousands of sequential tab stops in the reader.
  Acceptance:
    - KaraokeHighlighter no longer puts `tabIndex=0` on every word span; a roving-tabindex or single focusable container provides keyboard click-to-jump
    - Enter/Space on a focused word still jumps; live region unchanged; a test asserts tab-stoppable elements are O(sentences), not O(words)
  Verify: `pnpm --filter @readmaxxing/ui test`
  Files: packages/ui/src/primitives/KaraokeHighlighter.tsx, packages/ui/src/primitives/cross-surface.test.tsx
  Epic: A11y-Perf  Priority: P1  D-conflict: none

- [ ] P-089 — Add WCAG contrast tests and fix the tertiary-text token that fails AA
  Goal: Back the contrast claims with automated checks.
  Acceptance:
    - A unit test computes contrast for text-primary/secondary/tertiary against each theme surface; body-size tokens meet ≥4.5:1 or are documented as large/decorative-only
    - `textTertiary` on light canvas (~2.9:1) is darkened to pass AA where used as body, or its usage restricted; the AAA/7:1 header claim holds or is corrected
  Verify: `pnpm --filter @readmaxxing/ui test`
  Files: packages/ui/src/themes.ts, packages/ui/src/primitives/cross-surface.test.tsx
  Epic: A11y-Perf  Priority: P1  D-conflict: none

- [ ] P-090 — Remove the O(n²) per-word lookup in KaraokeHighlighter
  Goal: Precompute global word indices for large documents.
  Acceptance:
    - Per-word `globalIdx` is no longer computed via `flat.find` inside the render map; each word carries a precomputed index from `flatten()`
    - Rendering a 10k-word document does not regress INP (UI-UX §10 budget INP<100ms)
  Verify: `pnpm -w lint && pnpm --filter @readmaxxing/web build`
  Files: packages/ui/src/primitives/KaraokeHighlighter.tsx
  Epic: A11y-Perf  Priority: P2  D-conflict: none

- [ ] P-091 — Make gamification primitives + buttons theme-aware (e-ink "no accents")
  Goal: Honor the documented e-ink constraint and tokenize hover states.
  Acceptance:
    - StreakRing/XPBar derive colors from CSS vars / a theme-aware prop instead of hardcoded `#FF5C44/#C97A0F/#1F9E5A/#FFEFC5`; in eink they render grayscale
    - Button hover darken (`#E54E37/#B82626`) replaced with a per-theme token (e.g. `--coral-bg-hover`)
  Verify: `pnpm --filter @readmaxxing/ui test && ! grep -rnE "#FF5C44|#E54E37|#C97A0F" packages/ui/src/primitives`
  Files: packages/ui/src/primitives/StreakRing.tsx, packages/ui/src/primitives/XPBar.tsx, packages/ui/src/primitives/Button.tsx, packages/ui/src/themes.ts, packages/ui/tailwind.config.ts
  Epic: A11y-Perf  Priority: P2  D-conflict: none

- [ ] P-092 — Single-source brand/semantic colors so tokens.ts and tailwind.config.ts can't drift
  Goal: Eliminate duplicated hex literals between the two files.
  Acceptance:
    - `tailwind.config.ts` colors reference `tokens.ts` brand/semantic constants instead of re-typed hex; changing a hex in tokens.ts changes Tailwind output
    - No duplicated hex literals between the two files
  Verify: `pnpm -w typecheck && pnpm --filter @readmaxxing/web build`
  Files: packages/ui/src/tokens.ts, packages/ui/tailwind.config.ts
  Epic: A11y-Perf  Priority: P2  D-conflict: none

- [ ] P-093 — Replace 5s SSE DB polling with LISTEN/NOTIFY and fix the event-name mismatch
  Goal: Real cross-device push, or honest docs.
  Acceptance:
    - `positions/stream` advances its watermark per tick (no fixed-since re-scan); SSE server event name and client `addEventListener` name match
    - Either Postgres LISTEN/NOTIFY push is implemented or the comments are corrected to describe polling as final; heartbeat + abort covered by a test
  Verify: `pnpm --filter @readmaxxing/web test`
  Files: apps/web/app/api/positions/stream/route.ts, packages/core/src/sync/position-store.ts, apps/web/app/reader/[docId]/page.tsx
  Epic: A11y-Perf  Priority: P2  D-conflict: none

- [ ] P-094 — Either wire PositionStore everywhere or delete it
  Goal: Remove the dead debounce/reconcile/SSE class ambiguity.
  Acceptance:
    - Reader page + Player + extension + mobile all use a single PositionStore, OR the class is removed and inline fetches are the documented path
    - An integration test drives one device's POST and observes the SSE event on a second subscriber
  Verify: `pnpm -w test`
  Files: packages/core/src/sync/position-store.ts, apps/web/app/api/positions/stream/route.ts, apps/web/app/reader/[docId]/page.tsx
  Epic: A11y-Perf  Priority: P2  D-conflict: none

- [ ] P-095 — Add Next.js error/not-found/loading boundaries app-wide
  Goal: Branded, resilient states instead of the default Next overlay.
  Acceptance:
    - `apps/web/app/error.tsx` renders a branded recoverable error with retry; `not-found.tsx` a branded 404 with a path back to /library; a root `loading.tsx` skeleton
    - Throwing in a page during dev shows the custom boundary
  Verify: `pnpm --filter @readmaxxing/web build && ls apps/web/app/error.tsx apps/web/app/not-found.tsx`
  Files: apps/web/app/error.tsx, apps/web/app/not-found.tsx, apps/web/app/loading.tsx
  Epic: A11y-Perf  Priority: P2  D-conflict: none

### Testing

- [ ] P-096 — Harden CI to match the documented verify gate
  Goal: Give contributors the same gate the docs promise.
  Acceptance:
    - CI runs `pnpm -w test` with Postgres+Redis service containers for DB-touching tests (or clearly scopes which run without infra)
    - Lint is blocking (remove `|| true`) or the relaxation is justified in a comment; CI green on a clean checkout
  Verify: `grep -q 'pnpm.*test' .github/workflows/ci.yml && ! grep -q 'lint.*|| true' .github/workflows/ci.yml`
  Files: .github/workflows/ci.yml
  Epic: Testing  Priority: P2  D-conflict: none

- [ ] P-097 — Unit-test the TTS alignment→marks converter and chunk-stitch rebasing
  Goal: Cover the currently-untested core TTS logic.
  Acceptance:
    - A test feeds a synthetic ElevenLabs alignment and asserts word+sentence marks with correct offsets/times
    - A test asserts multi-chunk stitching rebases marks by char offset + cumulative duration; covers the leading-punctuation/contraction edge case
  Verify: `pnpm --filter @readmaxxing/web test -- tts`
  Files: apps/web/app/api/tts/route.test.ts, packages/tts/src/adapters/elevenlabs.test.ts
  Epic: Testing  Priority: P1  D-conflict: none

- [ ] P-098 — Add route-level tests for ask + assistant (streaming + error paths)
  Goal: Cover the streaming Q&A surface beyond the component test.
  Acceptance:
    - Ask streaming happy path (meta/delta/done NDJSON) with mocked `dispatchAiStream`; 401/404/400 paths
    - Assistant episode-not-ready (409) and document_not_found (404)
  Verify: `pnpm --filter @readmaxxing/web test -- ai/ask ai/assistant`
  Files: apps/web/app/api/ai/ask/route.test.ts, apps/web/app/api/ai/assistant/route.test.ts
  Epic: Testing  Priority: P1  D-conflict: none

- [ ] P-099 — Add an end-to-end test for the summary generate + cache-hit paths
  Goal: Cover beyond the current 401/400 tests.
  Acceptance:
    - A test mocks dispatchAi/loadDocument and asserts the 201 path returns `{content:{tldr,bullets,detailed},citations,model}`
    - A test asserts the cache-hit (`cached:true`) path; runs without a live key or DB
  Verify: `pnpm --filter @readmaxxing/web test -- summary`
  Files: apps/web/app/api/ai/summary/route.test.ts
  Epic: Testing  Priority: P2  D-conflict: none

- [ ] P-100 — Add an end-to-end podcast happy-path test (create + stream + transcript)
  Goal: Catch the casing + id wiring bugs in CI.
  Acceptance:
    - A test (mocked/real worker) asserts POST creates a completed episode, GET `/[id]` returns it, `/[id]/stream` returns audio (or 206 + Content-Range), `/[id]/transcript` returns lines
    - The test fails on current code and passes after P-020/P-021
  Verify: `pnpm --filter @readmaxxing/web test apps/web/app/api/ai/podcasts`
  Files: apps/web/app/api/ai/podcasts/route.test.ts, apps/web/app/api/ai/podcasts/[id]/stream/route.test.ts
  Epic: Testing  Priority: P1  D-conflict: none

- [ ] P-101 — Add an OCR import route test (mock worker)
  Goal: Cover success + the error matrix without Docker.
  Acceptance:
    - Mocks `callWorkerOcr`/fetch and asserts: 201 with documentId, 400 on blank text, 413 on >5MB, 415 on pdf field, 401 without user
    - Runs in CI without Docker
  Verify: `pnpm --filter @readmaxxing/web test -t "import/ocr"`
  Files: apps/web/app/api/import/ocr/route.ts, apps/web/app/api/import/ocr/route.test.ts
  Epic: Testing  Priority: P2  D-conflict: none

- [ ] P-102 — Add a reader highlight-tracks-audio end-to-end test
  Goal: Lock in the time→word mapping and the mixed-marks pitfall.
  Acceptance:
    - A test feeds a known marks array + simulated currentTime and asserts the resolved word index matches the wordTimeline mapping
    - Covers the mixed word+sentence marks pitfall the comments warn about; runs without Docker
  Verify: `pnpm -w test`
  Files: apps/web/app/reader/[docId]/page.tsx, packages/core/src/player/karaoke-sync.test.ts
  Epic: Testing  Priority: P3  D-conflict: none

- [ ] P-103 — Add a cross-runtime golden segment-tree parity fixture
  Goal: Prevent silent TS↔Python divergence.
  Acceptance:
    - A shared fixture (paragraphs/sentences/words/offsets/segmentTreeId for a multi-paragraph doc with headings, lists, abbreviations, quotes) exists
    - A TS test and a Python test both assert against it; trim leading-newline after Title:/Author: strip so `test_title_author_prefix_parsing` passes
  Verify: `cd services/worker-python && python3 -m pytest tests/test_segment_tree_parity.py -q && cd ../../.. && pnpm --filter @readmaxxing/core test`
  Files: packages/core/src/segment-tree.test.ts, services/worker-python/tests/test_segment_tree_parity.py, packages/core/src/pipeline/segment-tree.ts, services/worker-python/app/tasks/parse.py
  Epic: Testing  Priority: P2  D-conflict: none

- [ ] P-104 — Add habit + cross-surface integration tests against a real DB
  Goal: Cover leaderboard/quests/badges GET and position round-trip.
  Acceptance:
    - DB-touching tests run under Docker for the three habit GET routes (correct shape with seeded XpEvent), and for POST-on-A / resume-on-B positions
    - Tests gated/skipped cleanly when Docker is down
  Verify: `docker compose up -d && pnpm --filter @readmaxxing/web test -- habits positions`
  Files: apps/web/app/api/habits/leaderboard/route.test.ts, apps/web/app/api/habits/quests/route.test.ts, apps/web/app/api/habits/badges/route.test.ts, apps/web/app/api/positions/route.ts
  Epic: Testing  Priority: P2  D-conflict: none

## First 5

1. **P-010 — Add an OSS LICENSE.** Highest-value, lowest-risk launch blocker; the repo legally is not open source without it, and README actively says "Proprietary".
2. **P-011 — Create .env.example.** Onboarding is broken (README/docker-compose tell contributors to copy a file that doesn't exist); pure additive hygiene, no code risk.
3. **P-001 — Reconcile IMPLEMENTATION-STATUS.md.** Doc-only change that stops the loop (and contributors) from chasing false "501/stub" leads on routes that are actually real.
4. **P-017 — Fix the missing `await` on `acomplete`.** A genuine one-line correctness bug that silently breaks the worker AI path; trivial fix, isolated, and unblocks a real deploy mode.
5. **P-016 — Enforce X-Worker-Token on the worker.** Concrete P0 security gap (every `/v1/*` endpoint is unauthenticated) with a clean, well-scoped fix and a clear test; do it before any other Fix-Stubs work that touches the worker surface.
