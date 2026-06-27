# ReadMaxxing — Testing & Observability Guide

> **One-page summary.** We test the **user-visible contract**, not the implementation. Every UI-UX.md non-negotiable has a literal acceptance test (§3), every critical function emits a structured log (§9), and the failure cost is loss of user trust — which means the test that matters most is "does the reader experience feel telepathic?" Observability is the seatbelt for every other test: when a contract slips in production, logs and metrics are how we notice before users do.
>
> **Quick links.** [Test runner setup](#1-test-pyramid--tooling) · [Critical test cases](#2-critical-test-cases-by-feature) · [Non-negotiables → acceptance tests](#3-uiux-non-negotiables--acceptance-tests) · [Performance budgets](#4-performance-budgets-ui-ux-md-10) · [Accessibility suite](#5-accessibility-test-suite) · [Observability architecture](#8-observability-architecture) · [Critical logging points](#9-critical-logging-points-the-every-critical-point-has-a-log-section) · [Runbooks](#10-runbooks) · [Production readiness checklist](#11-production-readiness-checklist-per-release)

---

## Table of contents

0. [Testing philosophy](#0-testing-philosophy)
1. [Test pyramid & tooling](#1-test-pyramid--tooling)
2. [Critical test cases by feature](#2-critical-test-cases-by-feature)
3. [UI/UX non-negotiables → acceptance tests](#3-uiux-non-negotiables--acceptance-tests)
4. [Performance budgets (UI-UX.md §10)](#4-performance-budgets-ui-ux-md-10)
5. [Accessibility test suite](#5-accessibility-test-suite)
6. [Cross-browser & cross-device matrix](#6-cross-browser--cross-device-matrix)
7. [Security & privacy test cases](#7-security--privacy-test-cases)
8. [Observability architecture](#8-observability-architecture)
9. [Critical logging points](#9-critical-logging-points-the-every-critical-point-has-a-log-section)
10. [Runbooks](#10-runbooks)
11. [Production readiness checklist (per release)](#11-production-readiness-checklist-per-release)
12. [Test data & fixtures](#12-test-data--fixtures)
13. [Open questions](#13-open-questions)

---

## 0. Testing philosophy

1. **Test the user-visible contract, not the implementation.** A unit test on `SegmentTree` matters only insofar as the reader sees correct word offsets and stable highlighting. The integration that matters is "click the 37th word at second 8.2, the player seeks to within 150ms." If a refactor breaks the test but not the user experience, the test was wrong.
2. **Every UI-UX.md non-negotiable gets a literal acceptance test.** The seven non-negotiables in UI-UX.md §14 are encoded one-for-one in [§3](#3-uiux-non-negotiables--acceptance-tests) as auditable, runnable checks. If a non-negotiable has no test, it is not a non-negotiable.
3. **Failure cost is loss of user trust.** Reader apps live and die on "did the player just do what I asked?" A flaky seek, a missed highlight, a lost streak — each one is a small abandonment. Treat P0 test failures as incidents, not tickets.

**Test ladder (cheap → expensive, run order):** `pnpm typecheck` → `pnpm lint` → unit (vitest, per-package) → integration (vitest + Prisma test db + Redis test container) → component (vitest + @testing-library/react + jsdom + fake-indexeddb) → E2E (Playwright) → manual accessibility sweeps. Every PR runs at least through integration; E2E + perf + a11y run on `main` and pre-deploy.

---

## 1. Test pyramid & tooling

| Layer | Runner | Scope | When |
| --- | --- | --- | --- |
| **Unit** | `vitest` per package | `packages/core` (segment-tree builder, `locateWord`, `globalWordOffset`, `findWordAtTime`), `packages/tts` (speech-mark normalization, router policy, voice lookup), `packages/ai` (prompt helpers, citation rule, retry/fallback), `packages/config` (zod env) | Every PR, every commit. Target: **80% line / 70% branch** on `packages/core` and `packages/tts`. |
| **Integration** | `vitest` + `@prisma/client` against a throwaway Postgres + ioredis-mock | API route handlers (`apps/web/app/api/**`), Celery tasks in `services/worker-python/app/tasks/**` (run via `celery -A app.celery_app:celery_app worker --pool=solo` against a test Redis), Prisma migrations | Every PR. |
| **Component** | `vitest` + `@testing-library/react` + `jsdom` + `fake-indexeddb` | `packages/ui/src/primitives/**` (Player, KaraokeHighlighter, ReaderColumn, VoicePicker, StreakRing, Leaderboard), the BFF adapters in `apps/web/components/**` | Every PR. |
| **E2E** | `@playwright/test` | The four hero flows: library → import → reader → player; plus AI recap on return; plus cross-device resume. Runs headless in CI on Chromium + WebKit + Firefox. Mobile via BrowserStack or Maestro. | On merge to `main` and pre-deploy. |
| **Manual / Exploratory** | Human + checklists in `/docs/runbooks/manual-qa.md` (to be created) | WCAG keyboard sweep, screen reader sweep (NVDA + VoiceOver), dyslexic reader review, low-vision readability review, Safari Web Audio quirks | Pre-release and after any UI-affecting change. |

**Coverage targets per package.**

| Package | Target | Why |
| --- | --- | --- |
| `packages/core` | 80% line / 70% branch | The segment-tree builder is the universal data model; a wrong offset breaks every consumer. |
| `packages/tts` | 80% line / 70% branch | The router's provider-selection policy is the single source of "which voice do I get?" — bugs here are invisible and expensive. |
| `packages/ai` | 70% line | Prompt helpers + the citation regex are the audit point; the OpenRouter HTTP wrapper is exercised by integration. |
| `packages/ui` | 60% line | Primitives are easy to render; the cost is in interaction states which component tests cover. |
| `services/worker-python` | 70% line | Mirrors `packages/core` builder exactly — `tests/test_segment_tree_parity.py` is a hard contract. |
| `apps/web` (BFF) | 50% line | Routes are thin; full coverage comes from E2E. |

**Configuration.** Every package owns a `vitest.config.ts` (see `packages/core/vitest.config.ts`). Turbo runs `test` before `build` in `turbo.json` so a failing test blocks the deployable.

**What NOT to test.**
- Third-party SDK internals (`@privy-io/*`, `pdfjs-dist`, `mammoth`, `@mozilla/readability`, Prisma's query engine, `idb`).
- The generated `@prisma/client` (`packages/db/src/index.ts` re-export only).
- `tailwindcss` and `next/font` output.
- Anything whose failure would be caught by `tsc --noEmit` at the type level (don't write a runtime test for "string is non-empty").

**Test naming.** `*.test.ts(x)` co-located with source for unit and component tests. `*.integration.test.ts` for tests that touch Prisma/Redis. `e2e/*.spec.ts` for Playwright. Python: `tests/test_*.py` (see `services/worker-python/tests/test_segment_tree_parity.py` for the canonical pattern).

---

## 2. Critical test cases by feature

Each case uses **GIVEN / WHEN / THEN**, names a file path, and ties back to the UI-UX.md section or plan step it defends.

### 2.1 Auth — Privy middleware + webhook + user-mirror

Defends: UI-UX.md §11 (consistency, no dead ends), D4 in `CHANGELOG.md`, plan Phase 1.

1. **GIVEN** a request to `/api/documents` with a valid Privy access token in `Authorization: Bearer …` **WHEN** the middleware in `apps/web/middleware.ts` runs **THEN** the request is allowed and the handler sees `x-user-id` set to the `sub` claim.
2. **GIVEN** a request with a token whose signature was tampered (mutate one byte) **WHEN** the middleware runs **THEN** the response is `401` and the error is `{"error":"unauthorized"}` — no Prisma lookup, no DB hit.
3. **GIVEN** a request with no `Authorization` header to `/api/import` **WHEN** the middleware runs **THEN** the response is `401`; `/api/health` and `/api/auth/webhook` remain reachable (the allow-list in `apps/web/middleware.ts`).
4. **GIVEN** a Privy webhook POST to `/api/auth/webhook` with a valid HMAC header **WHEN** the handler in `apps/web/app/api/auth/webhook/route.ts` runs **THEN** a `User` row is upserted (`user.created` / `user.updated` / `user.linked_account` events) and the response is `200`.
5. **GIVEN** a webhook POST with a wrong HMAC **WHEN** the handler runs **THEN** the response is `401` and no `User` row is created.
6. **GIVEN** a webhook POST with a replayed payload (same timestamp, already processed) **WHEN** the handler runs **THEN** the response is `200` (idempotent) and no duplicate row exists.
7. **GIVEN** a developer-mode fallback (`NODE_ENV !== "production"` + the `lib/auth/dev.ts` shape) **WHEN** an unauthed request reaches a protected route **THEN** the dev shim sets `x-user-id` to the test user and logs `auth.dev_bypass_used` — the log is greppable so we notice if it leaks to prod.

### 2.2 Document import pipeline — PDF / DOCX / MD / EPUB / URL / paste / OCR

Defends: plan Phase 2 (steps 1–2), UI-UX.md §10 (parsing off the main thread), D2 (raw files stay client-side).

1. **GIVEN** a 2-page PDF with one column of body text **WHEN** `apps/web/app/api/import/route.ts` enqueues `app.tasks.parse.parse_document` **THEN** the `Document.segmentTree` JSONB column contains paragraphs → sentences → words with monotonically increasing `globalWordOffset` and the `wordCount` matches `sum(len(sentences.words))`.
2. **GIVEN** a DOCX with headings, lists, and a code block **WHEN** the parser runs **THEN** the segment tree preserves heading levels (`paragraph.kind === "heading"` with `level: 2`) and code blocks stay verbatim (no smart-quote mangling).
3. **GIVEN** a Markdown file with `#`, `##`, lists, and inline code **WHEN** parsed **THEN** `kind` and `level` are correctly assigned per UI-UX.md §5 (Bionic + auto-scroll need paragraph kind) and `globalWordOffset` is contiguous across headings.
4. **GIVEN** an EPUB with two chapters **WHEN** parsed **THEN** each chapter becomes a top-level paragraph group with `chapterIndex` set; a reader can seek across chapters.
5. **GIVEN** a public URL `https://example.com/article` **WHEN** the BFF fetches via `playwright` + `@mozilla/readability` **THEN** the parsed segment tree contains the article body only (no nav, no ads, no footer); a request that 4xx/5xx returns `{"error":"import_failed","hint":"Couldn't reach the page"}`.
6. **GIVEN** pasted text containing em-dashes, smart quotes, and an abbreviation like "Dr." **WHEN** parsed **THEN** the abbreviation-aware sentence splitter in `packages/core/src/pipeline/segment-tree.ts` does not split "Dr." into its own sentence; smart quotes round-trip unchanged.
7. **GIVEN** a 12MB scanned PDF (no text layer) **WHEN** `app.tasks.ocr.ocr_image` runs **THEN** the OCR confidence median is ≥ 0.85 and pages below the threshold (`< 0.6`) are surfaced as warnings, not silently passed.
8. **GIVEN** a corrupt PDF (truncated bytes) **WHEN** import runs **THEN** the user sees the human error `Couldn't read this file — try another format` and the `ImportJob` row stores `errorMessage: "pdf_parse_failed"` — no 500 to the client.

### 2.3 Segment-tree builder — the universal data model

Defends: D5 (`packages/core` is the single source of truth), every reader surface.

1. **GIVEN** the text `"The quick brown fox jumps."` **WHEN** the builder in `packages/core/src/pipeline/segment-tree.ts` runs **THEN** `locateWord(tree, 2)` returns the third word ("brown") and its `(paragraphIndex, sentenceIndex, wordIndex)` triple.
2. **GIVEN** a tree with N words **WHEN** `globalWordOffset` is summed **THEN** the total equals `N` and `locateWord(tree, 0)` and `locateWord(tree, N-1)` resolve without throw.
3. **GIVEN** the same text parsed by the TS builder and the Python builder in `services/worker-python/app/tasks/parse.py` **WHEN** `services/worker-python/tests/test_segment_tree_parity.py` runs **THEN** every paragraph/sentence/word's `text`, `startOffset`, `endOffset`, and `globalWordOffset` matches the TS output bit-for-bit.
4. **GIVEN** a sentence with a contraction `"don't"` **WHEN** tokenized **THEN** the tokenizer emits two words (`"don"`, `"'t"`) or one with `kind: "contraction"` — and either way `findWordAtTime(speechMark)` matches a single time, not two.
5. **GIVEN** a sentence with a URL (`"see https://x.com"`) **WHEN** tokenized **THEN** the URL stays a single word (no space-splitting on `:` or `/`) so TTS doesn't read it as "see https colon slash slash x dot com".
6. **GIVEN** a tree with mixed languages (Latin + CJK + Arabic) **WHEN** the word-count metric is requested **THEN** CJK is counted per character (per Unicode segmentation) and RTL text keeps its direction in the rendered column.
7. **GIVEN** a 100k-word document **WHEN** the builder runs in a web worker **THEN** it completes in < 1s on a baseline MacBook Air and yields control back to the main thread at least every 50ms (no jank test — `performance.now()` deltas between yields).

### 2.4 TTS provider layer + speech marks

Defends: plan Phase 2 (step 7, 11), D6 (per-provider speech-mark strategy), UI-UX.md §4.1 / §4.8.

1. **GIVEN** the TTSRouter with a non-premium user and a request for a premium voice **WHEN** `router.route(request)` runs **THEN** it falls back to a non-premium voice of the same language and logs `tts.premium_fallback`.
2. **GIVEN** an ElevenLabs voice **WHEN** `packages/tts/src/adapters/elevenlabs.ts` `streamSynthesize` runs **THEN** the returned `AsyncIterable<AudioChunk>` yields at least one chunk within 600ms (UI-UX.md §4.1) and each chunk has a matching `SpeechMark[]` covering the chunk's word range.
3. **GIVEN** an OpenAI voice (which lacks native marks) **WHEN** the adapter runs **THEN** estimated speech marks are produced from `(durationMs, wordCount)` that round-trip through `findWordAtTime` (`packages/tts/src/speech-mark.ts`) with ≤ 80ms error at the midpoint of each sentence.
4. **GIVEN** a request for a voice the router doesn't know **WHEN** `route` runs **THEN** the response is `404 tts.voice_not_found` and no provider call is made.
5. **GIVEN** ElevenLabs returns a 5xx mid-stream **WHEN** the adapter processes the stream **THEN** it falls back to OpenAI for the remainder, marks the chunk boundary, and emits `tts.provider_fallback` with `{from: "elevenlabs", to: "openai", reason}` — no audio gap > 250ms (UI-UX.md §3.4 motion budget).
6. **GIVEN** a voice marked `isMarquee: true` and a first-run user with no prior preference **WHEN** the library boots **THEN** the `VoicePicker` default tile is the marquee voice (UI-UX.md §6 + D11) and a click on "more voices" previews each on the user's actual text, not a generic sample.
7. **GIVEN** `streamSynthesize` interrupted by a client disconnect (close tab mid-stream) **WHEN** the provider's underlying `fetch` is aborted **THEN** the adapter releases the connection cleanly and logs `tts.client_disconnect` with `{chunkIndex, bytesSent}` — no orphaned billing.
8. **GIVEN** a premium request when ElevenLabs is rate-limited (429) **WHEN** the router retries **THEN** it backs off exponentially (max 2 retries, 200ms / 800ms) and surfaces a calm human error if all attempts fail.

### 2.5 Player & karaoke sync (the 12 rules of UI-UX.md §4)

Defends: UI-UX.md §4 rules 1–12 verbatim.

| # | Rule (UI-UX.md §4) | Test (GIVEN/WHEN/THEN) |
| --- | --- | --- |
| 4.1 | Load in < 1s | **GIVEN** a doc in `packages/core/src/sync/idb-cache.ts` **WHEN** the reader opens **THEN** `audio.play()` resolves within 1000ms on a fast-4G profile (Lighthouse perf budget in [§4](#4-performance-budgets-ui-ux-md-10)). |
| 4.2 | Primary controls only | **GIVEN** the reader page at viewport ≥ 768px **WHEN** rendered **THEN** only `Play/Pause`, scrubber, and `time` are in the always-visible PlayerBar; speed, voice, chapters, sleep, skip-fillers are inside a `DropdownMenu` triggered by a single icon. |
| 4.3 | Resume to exact word | **GIVEN** a `PlaybackPosition` with `wordOffset: 482` and `speed: 1.5` **WHEN** the reader loads **THEN** the first painted word is word 482 and `audio.currentTime` equals `speechMarks[482].startTimeMs / 1000 ± 0.05s`. |
| 4.4 | No autoplay with sound | **GIVEN** a fresh tab **WHEN** the reader mounts **THEN** the player is paused and the first user gesture (click/keydown) starts audio; the `autoplay` attribute is absent. |
| 4.5 | Smooth scrubber | **GIVEN** an audio element at `t=10s` **WHEN** the user drags the scrubber to `t=45s` **THEN** `audio.currentTime` updates within one frame (≤ 16ms) and no `seeked` event fires before the drag completes. |
| 4.6 | Speed 0.5×–4.5× pitch-preserved | **GIVEN** playback at 1× **WHEN** the user presses `↑` to 1.25× **THEN** `audio.playbackRate === 1.25` and `audio.preservesPitch === true` (or `webkitPreservesPitch` on Safari); the persisted speed in `PlaybackPosition.speed` matches. |
| 4.7 | Keyboard map | **GIVEN** the reader focused **WHEN** the user presses `Space` / `←` / `Shift+→` / `↑` / `J` / `K` / `R` / `F` / `/` **THEN** each shortcut performs its mapped action and `?` opens a discoverable shortcuts sheet. |
| 4.8 | Sentence + word karaoke | **GIVEN** speech marks for the current chunk **WHEN** `KaraokeHighlighter` advances **THEN** the active sentence gets a soft tint (`background: var(--color-sentence-tint)`) and the active word gets `var(--color-accent)` fill with a 120ms `ease-out` transition; the advance never strobes (> 3Hz). |
| 4.9 | Skip controls | **GIVEN** playback at sentence 5 of 10 **WHEN** the user presses `K` **THEN** playback advances to the start of sentence 6 and the highlight re-syncs to within 150ms. |
| 4.10 | Background + lock-screen + media-keys | **GIVEN** the tab is backgrounded **WHEN** audio continues **THEN** the OS media-key UI shows title, artist, and a working play/pause toggle (Media Session API); on iOS Safari, lock-screen controls work. |
| 4.11 | No mid-play recommendations | **GIVEN** playback active **WHEN** any component renders **THEN** no "Suggested next" or "Recommended for you" element is in the DOM (`querySelectorAll` for `[data-testid*="suggest"]` returns 0). |
| 4.12 | Offline-first | **GIVEN** the doc + audio + marks are in IndexedDB **WHEN** the network is offline (`page.context().setOffline(true)` in Playwright) **THEN** the reader mounts, plays, highlights, and seeks with zero `fetch`/XHR/SSE calls (verified via request listener). |

### 2.6 Playback positions + cross-device sync (SSE reconnect, conflict resolution)

Defends: plan Phase 2 step 10, UI-UX.md §4.3, §11.

1. **GIVEN** an open reader with a 1s-debounced position writer **WHEN** the user pauses **THEN** a single `POST /api/positions` is sent with the latest `wordOffset`, `speed`, and `lastPlayedAt`.
2. **GIVEN** two devices on the same doc, both playing within 200ms of each other **WHEN** both flush positions **THEN** the Postgres row reflects the **later** `lastPlayedAt` (last-write-wins on `(userId, documentId)`).
3. **GIVEN** an open EventSource on `/api/positions/stream` **WHEN** another device updates the position **THEN** the local reader's `lastSeenAt` updates within 2s (SSE poll cadence) and a "Resume on device B?" toast appears only if the drift is > 30s.
4. **GIVEN** an EventSource connection **WHEN** the network drops for 5s **WHEN** it returns **THEN** the client reconnects automatically (no user gesture) and resubscribes; the server uses a `Last-Event-ID` cursor to avoid replaying old updates.
5. **GIVEN** the SSE server **WHEN** it sends 1000 position updates/sec from a misbehaving client **THEN** it rate-limits at the BFF (`429` after N/sec) and never writes to Postgres more than once per debounce window per `(userId, documentId)` — the "SSE position sync flooding DB" runbook is exercised.
6. **GIVEN** a doc archived (`Document.archivedAt` set) **WHEN** a position update arrives **THEN** the server returns `200` (idempotent) and the row is preserved for audit but hidden from the Continue shelf.

### 2.7 Library + onboarding

Defends: UI-UX.md §6, D11.

1. **GIVEN** a first-run visitor with no auth **WHEN** they land on `/library` **THEN** the import surface is visible **without** a sign-in gate and the marquee voice tile is preselected (D11, "instant wow").
2. **GIVEN** a sample doc pre-loaded **WHEN** the user taps play **THEN** audio starts within 1s (no auth wall, no empty-state modal).
3. **GIVEN** the Continue shelf **WHEN** rendered **THEN** it shows ≤ 7 items, each with cover, title, progress %, and "X min left"; if the user has 0 in-progress docs, the shelf is hidden — not an empty card.
4. **GIVEN** 50 documents in the library **WHEN** the library renders **THEN** it shows 7 (or the configured `chunkSize`) with a "Load more" button; infinite scroll is **absent** (Miller's Law, decision fatigue).
5. **GIVEN** the 3-step coachmark **WHEN** all three steps are dismissed **THEN** it never reappears (persisted in `User.displayName`'s sibling metadata or `localStorage`), even after a full reload.
6. **GIVEN** a doc with `lastListenedAt > 24h` **WHEN** the library renders **THEN** the recap card shows `"Last time: you stopped at the section on X"` (Zeigarnik) and the card is dismissible per session.
7. **GIVEN** an empty library **WHEN** rendered **THEN** the empty state is the aspirational `Add your first book, article, or PDF` with a drag-drop target — no "Nothing here yet" plain text.
8. **GIVEN** the global search (`Cmd/Ctrl+K`) **WHEN** the user types 3 characters **THEN** results appear within 100ms (instant search) and the input retains focus.

### 2.8 AI Layer (summary / quiz / recap / ask / fillers)

Defends: UI-UX.md §7, plan Phase 3.

1. **GIVEN** a 5k-word doc **WHEN** the user opens the Summary card **THEN** the response includes three layered sections: TL;DR (≤ 1 line), bullets (3–7), detailed — never a wall of text.
2. **GIVEN** a Summary **WHEN** rendered **THEN** every claim links to a `(paragraphIndex, sentenceIndex)` anchor via `[cite:p:s]`-style references, and clicking the citation seeks the audio to that sentence within 200ms.
3. **GIVEN** a Quiz **WHEN** the user answers **THEN** feedback is immediate (< 200ms after submit), the correct answer is shown without shame ("Nice try — it's X" not "WRONG"), and the streak of correct recall is celebrated.
4. **GIVEN** the Recap on return **WHEN** the user opens a doc they last read 3 days ago **THEN** the recap is ≤ 2 sentences and references the specific section ("You stopped at 'On gradient checkpointing'"), not a generic summary.
5. **GIVEN** the Ask-the-doc chat **WHEN** the user asks a question **THEN** the response is grounded in the document (every claim cited) and quick chips ("explain like I'm 5", "give me an example") appear.
6. **GIVEN** any AI call expected to take > 2s **WHEN** it runs **THEN** the UI shows a calm status with an estimated time (e.g., "Reading doc ~ 8s") — never an indeterminate spinner (UI-UX.md §7 / §11).
7. **GIVEN** an AI call **WHEN** it fails (OpenRouter 5xx after retries) **THEN** the user sees `Couldn't reach the assistant — retry` and a Retry button — never `Error 503`.
8. **GIVEN** `detect_fillers` runs on a doc **WHEN** low-info segments are marked **THEN** the player's "Skip filler" toggle advances through them and the per-sentence skip count is logged for telemetry.

### 2.9 AI Podcasts

Defends: plan Phase 4, UI-UX.md §7 ("Honest staged progress").

1. **GIVEN** a podcast request for `style: "debate"` on a 4k-word doc **WHEN** `app.tasks.podcast.generate_podcast` runs **THEN** the script contains ≥ 2 speakers and the manifest JSON is written to `PODCAST_VOLUME_PATH/<document_id>/<episode_id>/manifest.json` before audio synthesis.
2. **GIVEN** the worker is producing audio **WHEN** the user polls `/api/podcasts/<id>/progress` **THEN** the response includes the real stage (`reading_doc` → `writing_script` → `casting_voices` → `producing_audio` → `completed`) with no fake "2 seconds" estimates.
3. **GIVEN** a completed episode **WHEN** the file is written to the volume **THEN** `ls -la <path>` shows an MP3 of expected size (estimated from `durationSeconds × bitrate` ± 10%) and `audioPath` matches `PODCAST_VOLUME_PATH` root.
4. **GIVEN** a podcast with 12 host lines and 11 guest lines **WHEN** mastering (gaps + optional music bed) finishes **THEN** total duration is within ± 5% of the sum of per-line durations + gaps and the final file is playable in the BFF's `/api/podcasts/<id>/stream` endpoint.
5. **GIVEN** the podcast feed **WHEN** rendered **THEN** it shows ≤ 7 episodes per chunk (Miller's Law) and "talk with the hosts" mode uses the same `Player` primitive — no separate widget.

### 2.10 Voice assistant

Defends: UI-UX.md §7 (assistant paragraphs), plan Phase 4.

1. **GIVEN** the assistant is open while a doc plays **WHEN** the user asks "summarize this" **THEN** the response is in the user's currently-selected TTS voice and cites the doc.
2. **GIVEN** the assistant is in voice-in mode (Web Speech API) **WHEN** the user speaks **THEN** interim transcripts appear within 500ms and the final transcript replaces them without flicker.
3. **GIVEN** a browser without Web Speech API (Firefox desktop) **WHEN** voice-in is requested **THEN** the UI prompts the user to type instead (graceful degradation, not silent failure).
4. **GIVEN** the assistant's response **WHEN** spoken aloud **THEN** the `MediaSession` metadata is updated to the assistant's voice name (lock-screen parity).

### 2.11 Voice typing (dictation, diff view)

Defends: UI-UX.md §7 ("never silently rewrites meaning"), plan Phase 5.

1. **GIVEN** a dictation session **WHEN** the Web Speech API transcript arrives **THEN** the editor shows raw text within 500ms — before any LLM cleanup.
2. **GIVEN** the LLM cleanup pass **WHEN** it produces output **THEN** the editor shows a side-by-side or inline diff view with insertions/deletions highlighted — the user can accept/reject each change.
3. **GIVEN** the LLM cleanup output that changes the meaning **WHEN** rendered **THEN** a "Changed meaning — review" badge appears on that span (the diff view makes it visible; no silent rewrites).
4. **GIVEN** a Whisper fallback path (Web Speech API fails) **WHEN** the worker transcribes **THEN** the same diff flow is used and the latency budget is the same (< 2s for a 30s utterance on baseline).

### 2.12 Voice cloning (consent flow, not skippable)

Defends: UI-UX.md §5.5 (consent), plan Phase 5, schema `Consent.kind = "voice_clone"`.

1. **GIVEN** the user opens Voice Cloning **WHEN** they attempt to record **THEN** the consent screen appears first — **unskippable** — and lists what the clone will be used for.
2. **GIVEN** the consent **WHEN** accepted **THEN** a `Consent { kind: "voice_clone", granted: true, version: "<sha>" }` row is inserted and the record button activates.
3. **GIVEN** a recorded sample < 30s **WHEN** submitted to `app.tasks.tts.clone_voice` **THEN** the worker rejects it (`sample_too_short`) and the UI asks for a longer sample.
4. **GIVEN** a cloned voice **WHEN** used in `streamSynthesize` **THEN** the `Voice` row has `isCloned: true` and `ownerId` set to the user; another user cannot select it.
5. **GIVEN** a `Consent.granted: false` row **WHEN** the user attempts to clone **THEN** the UI re-shows the consent flow.

### 2.13 OCR scan-and-listen

Defends: plan Phase 5 ("Scan & Listen").

1. **GIVEN** a clean scanned PDF (300 DPI, English) **WHEN** `app.tasks.ocr.ocr_image` runs **THEN** the per-page confidence median is ≥ 0.85 and the resulting segment tree matches the same shape as the text parser.
2. **GIVEN** a noisy phone photo of a book page **WHEN** OCR runs **THEN** PaddleOCR is preferred over Tesseract; if both engines fail (median confidence < 0.6), the user sees `We couldn't read this clearly — try a sharper photo` with a retry.
3. **GIVEN** a successful OCR **WHEN** the segment tree is built **THEN** the document is treated identically to any text import (same `Document.segmentTree` shape, same player behavior).
4. **GIVEN** the raw scan **WHEN** OCR completes **THEN** the scan bytes are **not** persisted server-side (D2); only the segment tree lives in Postgres.

### 2.14 Habit layer (streak / XP / leaderboard / badges / quests)

Defends: UI-UX.md §8, D10, plan Phase 5.5.

1. **GIVEN** a user reads today **WHEN** the daily goal is hit **THEN** `XpEvent { source: "daily_goal_bonus", amount: <configured> }` is inserted and `Streak.currentDays` increments by 1.
2. **GIVEN** a user who didn't read yesterday **WHEN** they read today **THEN** `Streak.freezesAvailable` decrements (if > 0) and `Streak.recoveredAt` is set; the UI message is `Streak frozen — pick it back up today 💪`, never anxious-red.
3. **GIVEN** a 24h grace window after a miss **WHEN** the user reads **THEN** `Streak.currentDays` continues from the previous count and a single recovery event is logged.
4. **GIVEN** a user who opted out of leaderboards (`User.displayName`'s sibling flag or `Consent.kind = "leaderboards"`) **WHEN** the leaderboard query runs **THEN** the user is excluded from public rankings and the UI hides the League tile.
5. **GIVEN** a user crosses the `xpThreshold` for a milestone **WHEN** `awardBadge` runs **THEN** a `UserBadge` row is inserted with `tierAtAward: bronze|silver|gold` and a celebratory (not anxious) UI notification fires.
6. **GIVEN** a weekly quest "Listen to 3 docs" **WHEN** the 3rd doc finishes **THEN** `QuestCompletion` is inserted, XP is awarded, and the quest appears in the user's completed list — but the celebration is one tap to dismiss, not modal-locked.
7. **GIVEN** the weekly digest push **WHEN** it fires **THEN** it reflects **real** numbers (`minutes`, `xp`, `rank`) and never inflates — UI-UX.md §14 #7.
8. **GIVEN** a streak of 0 **WHEN** the streak tile renders **THEN** the messaging is aspirational (`Start your streak today`), not shaming (`You lost your streak`).

### 2.15 Chrome extension (MV3, cross-origin extraction)

Defends: plan Phase 6, UI-UX.md §11 (cross-surface consistency).

1. **GIVEN** the extension is installed and active on `https://example.com/article` **WHEN** the user clicks the toolbar icon **THEN** an overlay `Player` appears (reusing `packages/ui/src/primitives/Player.tsx`) with controls identical to the web app.
2. **GIVEN** the user clicks "Read this page" **WHEN** the background worker extracts the article body via `@mozilla/readability` **THEN** the extracted text goes through the same `/api/import` endpoint and the segment tree is identical to a paste of the same text.
3. **GIVEN** the extension's manifest **WHEN** reviewed **THEN** it requests the minimum permissions (no `<all_urls>` if `activeTab` suffices; no `webRequestBlocking`).
4. **GIVEN** the extension tries to access `chrome.storage` on a CSP-restricted page **WHEN** the storage call fires **THEN** it fails gracefully (no console error spam; the user sees `Couldn't save on this page`).
5. **GIVEN** auth on web **WHEN** the user opens the extension **THEN** they are signed in via the same Privy session (shared cookies via `cookies` permission or a deep-link handoff).

### 2.16 Mobile (Expo / React Native)

Defends: plan Phase 6, UI-UX.md §3.3 (thumb-arc), §3.4 (motion), §9 (Dynamic Type).

1. **GIVEN** the iOS app is backgrounded during playback **WHEN** the lock screen appears **THEN** the OS Now Playing UI shows title/artist/cover and play/pause/skip controls work (Background Audio mode enabled).
2. **GIVEN** an Android device in Doze mode **WHEN** the user resumes the app **THEN** the position is within 5s of the web app (via the same SSE polling path).
3. **GIVEN** the on-device Piper/Kokoro model **WHEN** the device is offline **THEN** the reader plays a doc end-to-end with zero network calls (verified via Flight Mode).
4. **GIVEN** the iOS Dynamic Type setting is "AX5" **WHEN** the app renders **THEN** body type scales with the system setting (no `allowFontScaling={false}` anywhere) and the layout doesn't break (text-spacing floor respected).
5. **GIVEN** the primary play button **WHEN** measured on a 390×844 viewport **THEN** it is ≥ 56×56px and centered in the lower thumb arc (Fitts's Law).
6. **GIVEN** a push notification from Privy/Expo push **WHEN** tapped **THEN** it deep-links to the correct doc/reader route (verified via a deep-link handler test).

---

## 3. UI/UX non-negotiables → acceptance tests

The seven non-negotiables from UI-UX.md §14, each with the literal test that proves it. These are auditable on every release.

| # | Non-negotiable (UI-UX.md §14) | Acceptance test |
| --- | --- | --- |
| 1 | **The content is the hero. The UI recedes.** | **Automation:** Playwright `assert_no_visible_distraction` — on the reader route at viewport ≥ 1024px, the only elements above the fold are the reading column, the PlayerBar, and (optional) the thin progress rail. The number of `[role="button"]` elements in the viewport is ≤ 4 (Play, scrubber, menu, settings). **Manual:** a 5-second eye-track study with a fresh user — if they name any UI element before naming the content, fail. |
| 2 | **Time-to-play < 1s. Always.** | **Automation:** Lighthouse CI on `/library` and `/reader/[docId]` over the Fast 4G profile. `largest-contentful-paint < 1000ms` AND a custom metric `time-to-play` measured from `navigationStart` to `audio.play()` resolving < 1000ms for any doc already in the IndexedDB cache. Fails the build on regression. |
| 3 | **Resume to the exact word, on any device.** | **E2E (Playwright, two contexts):** in context A, open the reader, play to word 482, pause. Open context B (different `userId`-mirroring seed), navigate to the same doc — the audio starts at word 482 within ± 1 word (asserted by `await page.getByTestId("active-word").textContent()` matching the same word as in context A). |
| 4 | **Never break the flow state once entered.** | **E2E:** during a 60s playback window, the test counts: 0 modal opens, 0 toast notifications, 0 `confirm()` calls, 0 navigations away from the reader. The count is asserted via a `MutationObserver` and a `window.confirm` shim that increments a counter on any call. Fail on > 0 of any. |
| 5 | **WCAG 2.2 AA everywhere; AAA on the reading surface.** | **Automation:** `@axe-core/playwright` on every route — fail the build on **any** AA violation. **Manual sweep (pre-release):** NVDA on Windows + VoiceOver on macOS/iOS walks through library, reader, AI assistant, settings. **AAA on the reading surface:** body-text contrast ≥ 7:1 across all 4 themes (Light/Dark/Sepia/E-ink) — measured via a custom contrast assertion on the rendered `ReaderColumn`. |
| 6 | **Gamification pushes hard on streaks/identity/leagues — but never shames. Every loss is recoverable.** | **Visual regression:** Percy/Chromatic snapshots of the streak-broken state — assert no `color: red` / `color: #DC2626` / anxious-red tokens appear on the streak tile. **Copy review:** the streak-broken copy is exactly `"Streak frozen — pick it back up today 💪"` (or an approved variant). **Functional:** after a miss, `Streak.freezesAvailable` decrementing recovers the streak; there is no UI path that permanently zeroes `Streak.currentDays` without a recovery option. |
| 7 | **Honesty over persuasion — in numbers, in progress, in AI answers, in loading estimates.** | **Numerical honesty:** a fixture test asserts that `estimatedReadTimeSeconds` and `durationSeconds` on a podcast are within ± 10% of the actual measured value (no "4.2× faster" claims unless measured). **AI citation:** every `Summary.layers` and `ask` response contains ≥ 1 `[cite:p:s]` per non-trivial claim, asserted by parsing the model output before display. **Loading estimates:** every AI/podcast progress bar shows an ETA updated at least every 5s, never a static "2 seconds". |

---

## 4. Performance budgets (UI-UX.md §10)

Each budget names the tool, the threshold, and the exact CI step. All thresholds fail the build on regression.

| Budget | Tool | Threshold | CI step |
| --- | --- | --- | --- |
| **LCP on reader page (Fast 4G)** | Lighthouse CI (`@lhci/cli`) against `apps/web` running on `next start` | LCP < **1.0s** on Fast 4G profile, mobile viewport | `.github/workflows/perf.yml` `lhci autorun --collect.settings.preset=desktop` and a separate mobile run; budget assertions in `lighthouserc.json` |
| **Time-to-play (any doc in library)** | Custom Playwright perf test: `navigationStart` → `audio.play()` resolves | < **1.0s** for any doc with cached audio+marks in IndexedDB | `apps/web/tests/perf/time-to-play.spec.ts` runs on every PR; asserted via `performance.measure('time-to-play', 'navigationStart', 'audio-play-resolved')` |
| **INP** | `web-vitals` field data + Lighthouse lab | INP < **100ms** at the 75th percentile in the field; lab fails if any interaction > 200ms | Field: Sentry RUM + a Grafana panel on `web_vitals.inp`. Lab: Playwright trace `interaction-to-next-paint` assertion |
| **Word-highlight advance jitter** | Playwright trace assertion on a 30s karaoke sample | Each word-advance paint within **< 16ms** of the expected frame; no advance later than 32ms after the speech mark | `apps/web/tests/perf/karaoke-jitter.spec.ts` runs on every PR; asserts `performance.now()` deltas between `requestAnimationFrame` and the speech mark's `startTimeMs` |
| **Reader route JS size** | `@next/bundle-analyzer` + `size-limit` | ≤ **150KB** gzip for the reader route's first-load JS | `apps/web/package.json` `size-limit` config; runs in `turbo.json` `build` pipeline; CI step uploads the report |
| **CLS while streaming audio + loading marks** | Playwright visual regression + `layout-shift` perf entry | CLS < **0.05** across the first 10s of any reader session | `apps/web/tests/perf/cls.spec.ts` — uses `PerformanceObserver({ type: 'layout-shift' })`; fails on cumulative shift > 0.05 |
| **Offline: zero network calls** | Playwright `context.setOffline(true)` after the first play | 0 `request`/`fetch`/XHR/SSE events during a 60s playback window after the cache is warm | `apps/web/tests/perf/offline.spec.ts` — attaches a `page.on('request')` listener and asserts the array is empty |

**CI wiring (sketch).**

```yaml
# .github/workflows/perf.yml (sketch)
jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate:deploy && pnpm build
      - run: pnpm dlx @lhci/cli@latest autorun
      - run: pnpm vitest run --config apps/web/vitest.perf.config.ts
      - run: pnpm exec playwright test --grep @perf
```

---

## 5. Accessibility test suite

- **`@axe-core/playwright` CI** — runs on every route (library, reader, settings, AI assistant, podcast feed, voice typing, voice clone consent, OCR import). **Fails the build on any AA violation.** AAA contrast assertions live in a custom rule (`packages/ui/src/a11y/aaa-contrast.ts`) that asserts body text in `ReaderColumn` ≥ 7:1 across all 4 themes.
- **Keyboard sweep** (manual, pre-release): Tab order is logical (header → main content → player → menu items); every interactive element shows a visible focus ring (never `outline: none` without a replacement); `Esc` closes any open modal/dropdown; `Shift+Tab` returns focus to the trigger. Documented in `/docs/runbooks/manual-qa.md` (to be created).
- **Screen reader sweep** (manual, pre-release): NVDA on Windows + VoiceOver on macOS and iOS, covering the reader, library, AI assistant, and voice typing. Specifically: the `aria-live="polite"` region announces the current sentence for blind-readers; the karaoke highlighter does not spam announcements (one announcement per sentence, not per word).
- **`prefers-*` verification** — DevTools rendering toggles for `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency` are exercised in Playwright via `await page.emulateMedia({ reducedMotion: 'reduce' })` and the assertion is that non-essential motion stops (the karaoke advance still happens but without the 120ms transition; auto-scroll is disabled).
- **WCAG 2.2 SC 1.4.12 spacing floor** — a Playwright test injects a stylesheet that applies `line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;` and asserts no content is clipped or overlapped (UI-UX.md §3.2).
- **Dyslexic reader review** (manual, once per release) — a reviewer with dyslexia uses the app for 15 minutes across reader, library, AI assistant; their feedback is logged in `/docs/runbooks/dyslexia-review.md`.
- **Color contrast audit on all 4 themes** — a snapshot test in `packages/ui/src/themes.test.ts` walks every token's foreground/background pair and asserts the contrast ratio; theme presets are asserted at AA + AAA-on-reading-surface.

---

## 6. Cross-browser & cross-device matrix

Tested configurations. **Tier 1 = must-pass on every release; Tier 2 = must-pass monthly; Tier 3 = best-effort.**

| Tier | Browser | OS | Notes |
| --- | --- | --- | --- |
| 1 | Chrome (latest stable) | macOS, Windows, Android | The development baseline. |
| 1 | Safari (latest stable) | macOS | **Known quirk:** Safari Web Audio timing — `AudioContext.currentTime` and `audio.currentTime` can drift under load. The player uses `AudioContext.currentTime` as the source of truth and reconciles against `audio.currentTime` every 5s; assertion in `packages/ui/src/primitives/Player.test.tsx`. |
| 1 | Safari | iOS (latest 2 versions) | **Known quirk:** iOS background audio restrictions — the page must call `navigator.mediaSession.metadata = ...` and have a user gesture before the first play, or iOS suspends audio. Lock-screen controls require explicit Media Session API calls. |
| 1 | Edge (Chromium) | Windows | Tier 1 because of enterprise install base. |
| 2 | Firefox (latest stable) | macOS, Windows | **Known gap:** Firefox lacks reliable Web Speech API support on desktop — voice-in falls back to typing with a one-time notice. The fallback is tested in [§2.10](#210-voice-assistant). |
| 2 | Chrome | Android (latest 2 versions) | Tests background audio, lock-screen controls, Dynamic Type. |
| 2 | Samsung Internet | Android | Tier 2 for install-base. |
| 3 | Arc / Brave / Vivaldi | macOS / Windows | Smoke-tested on each major version bump; not gating. |
| 3 | Opera | macOS / Windows | Smoke-tested on each major version bump. |

**Mobile native.** iOS Safari, Android Chrome, Android Samsung Internet are tested via BrowserStack (or Maestro for native-shell flows like push notifications and lock-screen UI).

**Device lab fixture.** A `tests/fixtures/devices.json` enumerates the matrix; Playwright projects (`projects: [{ name: 'webkit', use: { ...devices['iPhone 14'] } }, ...]`) iterate.

---

## 7. Security & privacy test cases

Each case names the file path and the type of test.

| Concern | Test |
| --- | --- |
| **Privy JWT signature verification** | `apps/web/lib/privy-verify.test.ts`: GIVEN a token signed with the wrong secret WHEN `verifyPrivyIdentityToken` runs THEN it throws `InvalidToken` and the middleware returns 401 (no DB hit). Mirrors the production swap-in of `PrivyClient.utils().auth().verifyAccessToken`. |
| **Webhook HMAC verification** | `apps/web/app/api/auth/webhook/route.test.ts`: GIVEN a body with the wrong HMAC WHEN the handler runs THEN 401 and zero DB writes. GIVEN a replayed timestamp+payload WHEN the handler runs THEN 200 (idempotent). |
| **No raw uploaded files on server** | `apps/web/tests/security/raw-files.test.ts`: GIVEN an import flow THEN a CI step runs `psql -c "SELECT count(*) FROM storage.objects WHERE bucket_id='raw-uploads'"` (or the Railway equivalent) and asserts 0. A filesystem snapshot of the worker container is also asserted to contain only `PODCAST_VOLUME_PATH/...` writes, no upload blobs. |
| **No PII in logs** | `apps/web/tests/security/log-scan.test.ts`: GIVEN a sample of production logs (anonymized export) WHEN the test scans THEN no occurrences of email-shaped strings, no Privy user ids (only `user_id_hash`), no document titles, no audio bytes. The grep patterns live in `tests/security/log-pii-patterns.txt`. |
| **CSP headers present + no unsafe-eval** | A middleware test asserts `Content-Security-Policy` includes `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`), `frame-ancestors 'none'`, `default-src 'self'`. The build fails if `next.config.ts` adds a config that weakens this. |
| **Rate limiting** | `apps/web/tests/security/rate-limit.test.ts`: GIVEN 1000 requests/minute to `/api/import` from a single IP WHEN the 101st hits THEN 429. Same for `/api/tts` and `/api/positions`. The rate limiter is the BFF middleware in `apps/web/middleware.ts` (or a dedicated `apps/web/lib/rate-limit.ts` once added). |
| **SQL injection smoke** | `apps/web/tests/security/sql-injection.test.ts`: GIVEN strings like `'; DROP TABLE "User"; --` in search inputs (`?q=…`) and document titles WHEN queries run via Prisma THEN no exception, no data loss. (Prisma uses parameterized queries; this is a regression guard.) |
| **OpenRouter API key never leaks to client** | `apps/web/tests/security/key-leak.test.ts`: GIVEN a production build WHEN `grep -r "OPENROUTER_API_KEY\|sk-or-" .next/static/` runs THEN zero matches. CI step runs this grep on every PR. |
| **IndexedDB stores do not persist raw uploads** | `apps/web/tests/security/idb-audit.test.ts`: GIVEN a complete import + play + close flow WHEN the IndexedDB is inspected THEN the `documents` store contains only the `documentId` and metadata, not the original file bytes (D2). |
| **CSP / CORS on TTS streaming** | The TTS streaming proxy in `apps/web/app/api/tts/route.ts` sets `Content-Type: audio/mpeg` and `Cache-Control: private, max-age=86400`; the test asserts the upstream provider's API key is never echoed in `Access-Control-Expose-Headers`. |

---

## 8. Observability architecture

### 8.1 Logging standards

- **Format:** structured JSON to `stdout`. A `pino` instance in TS (`apps/web/lib/log.ts`) and a `structlog` instance in Python (`services/worker-python/app/logging.py`) emit the same shape.
- **Required fields on every log line:**
  - `ts` — ISO 8601 with milliseconds, UTC.
  - `level` — one of `debug`, `info`, `warn`, `error`.
  - `service` — `web` | `worker` | `extension` | `mobile`.
  - `request_id` — UUIDv7, generated at the BFF edge and propagated via `X-Request-Id` to the worker (Celery task header).
  - `user_id_hash` — `sha256(userId).slice(0, 16)` — never the raw Privy id.
  - `event` — kebab-case event name (see §9).
  - `duration_ms` — for any timed operation.
  - `status` — `ok` | `error` | `fallback`.
  - **No PII.** A redaction middleware scrubs email-shaped strings, JWTs, API keys, document titles, audio byte counts beyond what billing needs.
- **Levels:** `debug` is the default in dev; `info` in prod. `error` always pages on-call for the `tts.*` / `ai.*` / `sse.*` families.
- **Correlation:** `request_id` flows BFF → Celery task header → LLM call → Sentry breadcrumb → user-visible error toast. A "give me everything for this request" query joins logs by `request_id`.

### 8.2 Error tracking — Sentry

- **Setup.** `@sentry/nextjs` in `apps/web` (server + edge + browser); `sentry-sdk` in `services/worker-python`. DSNs from env, swapped per environment. `tracesSampleRate: 0.1` in prod, `1.0` in staging.
- **Source maps.** Uploaded on every release via `@sentry/webpack-plugin` (web) and `sentry-cli upload-dif` (worker). Releases tagged with the git SHA.
- **Sensitive-data scrubbing.**
  - `beforeSend` strips: raw audio byte counts > billing threshold, quiz answers, voice-clone sample metadata (paths and durations only, never bytes), document segment-tree bodies, LLM prompts and completions beyond their model + token counts.
  - The scrubber config lives in `apps/web/sentry.config.ts` and `services/worker-python/app/sentry_init.py`.
- **Release tagging.** `sentry-cli releases new <sha>` runs in CI; commits are associated; regressions show in the "Suspected Releases" view.

### 8.3 Metrics — OpenTelemetry

- **SDK.** `@opentelemetry/sdk-node` in TS (web BFF) and `opentelemetry-distro` in Python (worker). OTLP exporter to a Railway-acceptable collector (or Honeycomb if budget allows).
- **Auto-instrumentation.** HTTP, Prisma, Redis, fetch, FastAPI.
- **Custom business metrics** (UI-UX.md §13 KPIs):
  - `activation.time_to_first_play_ms` (histogram)
  - `aha.speed_adjusted_in_session_1` (counter, by `is_first_session`)
  - `aha.highlight_used_in_session_1` (counter)
  - `habit.d1_d7_d30_retention` (gauge, computed nightly)
  - `habit.sessions_per_week` (gauge)
  - `flow.session_uninterrupted_rate` (ratio)
  - `flow.resume_rate_after_pause` (ratio)
  - `comprehension.quiz_opt_in_rate` (ratio)
  - `comprehension.quiz_accuracy_avg` (gauge)
  - `friction.scrub_retry_rate` (ratio)
  - `friction.player_abandon_count` (counter, by reason)
- **RED metrics per service.** Rate / Errors / Duration for each BFF route group (`/api/tts`, `/api/import`, `/api/positions`, `/api/ai/*`, `/api/podcasts/*`) and each Celery queue (`parse`, `ocr`, `ai`, `podcast`, `tts`).

### 8.4 Real User Monitoring (RUM)

- **`web-vitals` library** in `apps/web/app/layout.tsx` — sends `LCP`, `INP`, `CLS`, `FCP`, `TTFB` to Sentry as custom measurements and to the OTLP collector as histograms.
- **Custom audio RUM.** A small module in `apps/web/lib/tts/client.ts` measures `time-to-play` end-to-end and reports `tts.time_to_play_ms` per `(provider, voiceId)`. This is what powers the first-chunk-latency dashboard.
- **Per-route error rate.** A Sentry alert fires when a route's error rate exceeds 1% over 5 minutes.

### 8.5 Log/metric catalog

See [§9](#9-critical-logging-points-the-every-critical-point-has-a-log-section) — every critical code path has a defined event with fields and anomaly thresholds. The catalog is the source of truth for what we emit; anything new must be added there before shipping.

### 8.6 Alerting

- **What pages on-call:**
  - Sentry `error` rate > 1% over 5 min for any BFF route.
  - `tts.first_chunk_latency_ms` p99 > 1500ms for 5 min.
  - `sse.positions.flooding_db` rate > 10/s for 1 min.
  - `worker.celery.queue_depth` > 1000 for any queue for 5 min.
  - Postgres connection pool > 80% utilization for 2 min.
  - Storage volume > 80% of allocated GB.
  - OpenRouter 5xx rate > 5% over 5 min.
  - Privy webhook 4xx rate > 1% over 10 min.
- **What does NOT page:** individual `tts.client_disconnect` (expected); a single slow LLM call (covered by aggregate); daily-goal email send failures (retried).

### 8.7 Privacy — what we DO and DO NOT log

**We log:**
- `user_id_hash` (sha256 truncated), `request_id`, service name, event name, durations, status codes, provider names, voice ids, model names, queue depths, byte counts for billing.
- Application state transitions (e.g., `streak.increment`, `badge.awarded`).
- Anomaly signals (drift, fallback, retry counts).

**We DO NOT log:**
- Email addresses, display names, avatars, wallet addresses.
- Document titles, segment-tree bodies, document text, summaries, quizzes, recaps, ask-the-doc conversations.
- Audio bytes, voice-clone sample paths, recording durations (beyond what's in `UsageLedger`).
- Privy access tokens, webhook payloads, OpenRouter API keys, raw LLM prompts/completions.
- IP addresses in production logs (hashed at the edge for abuse detection only; not retained beyond 24h).

---

## 9. Critical logging points (the "every critical point has a log" section)

For each entry: **function / endpoint / file path**, **event name**, **fields**, **level**, **anomaly definition**, **alert threshold**.

### Auth

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/middleware.ts:privyMiddleware` (token verify success) | `auth.login_success` | `request_id`, `user_id_hash`, `provider` | `info` | None | n/a |
| `apps/web/middleware.ts:privyMiddleware` (verify fail) | `auth.token_verify_failed` | `request_id`, `reason`, `has_bearer` | `warn` | rate of `reason="signature"` > 5/min/IP | > 50/min/IP |
| `apps/web/app/api/auth/webhook/route.ts` (receive) | `auth.webhook_received` | `request_id`, `event_type`, `user_id_hash` | `info` | HMAC fail rate | > 1% over 10 min |
| `apps/web/app/api/auth/webhook/route.ts` (HMAC fail) | `auth.webhook_hmac_failed` | `request_id`, `event_type` | `error` | any | ≥ 1 |
| `apps/web/app/api/auth/webhook/route.ts` (upsert) | `auth.user_upserted` | `user_id_hash`, `event_type`, `ms` | `info` | upsert failure | ≥ 1 |
| `apps/web/lib/auth/dev.ts:devBypass` | `auth.dev_bypass_used` | `request_id`, `route`, `node_env` | `warn` | any in production | ≥ 1 in prod |

### Import

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/app/api/import/route.ts` (POST received) | `import.received` | `request_id`, `user_id_hash`, `source_type`, `size_bytes` | `info` | None | n/a |
| `apps/web/app/api/import/route.ts` (enqueue) | `import.enqueued` | `request_id`, `document_id`, `queue`, `size_bytes` | `info` | None | n/a |
| `services/worker-python/app/tasks/parse.py:parse_document` (start) | `import.parse_start` | `request_id`, `document_id`, `source_type` | `info` | None | n/a |
| `services/worker-python/app/tasks/parse.py:parse_document` (complete) | `import.parse_complete` | `request_id`, `document_id`, `paragraph_count`, `word_count`, `duration_ms`, `status` | `info` | `status=error` rate | > 2% over 10 min |
| `services/worker-python/app/tasks/parse.py:parse_document` (error) | `import.parse_failed` | `request_id`, `document_id`, `error_class`, `error_msg` (redacted) | `error` | any | ≥ 5 in 5 min |
| `services/worker-python/app/tasks/ocr.py:ocr_image` | `import.ocr_complete` | `request_id`, `document_id`, `page_count`, `engine`, `median_confidence`, `duration_ms` | `info` | `median_confidence < 0.6` | ≥ 1 |

### TTS

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/app/api/tts/route.ts` (receive) | `tts.request_received` | `request_id`, `user_id_hash`, `voice_id`, `provider`, `text_bytes` | `info` | None | n/a |
| `packages/tts/src/router.ts:route` (premium fallback) | `tts.premium_fallback` | `request_id`, `requested_voice_id`, `fallback_voice_id` | `info` | rate | > 30% over 5 min |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (stream start) | `tts.stream_start` | `request_id`, `provider`, `voice_id`, `chunk_index` | `info` | None | n/a |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (first chunk) | `tts.first_chunk` | `request_id`, `provider`, `voice_id`, `first_chunk_ms` | `info` | `first_chunk_ms > 1500` | p99 > 1500ms over 5 min |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (complete) | `tts.stream_complete` | `request_id`, `provider`, `voice_id`, `total_ms`, `bytes_sent`, `mark_count`, `status` | `info` | `status=error` rate | > 1% over 5 min |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (provider fallback mid-stream) | `tts.provider_fallback` | `request_id`, `from_provider`, `to_provider`, `reason`, `chunk_index` | `warn` | any | ≥ 10 in 5 min |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (error) | `tts.stream_error` | `request_id`, `provider`, `voice_id`, `error_class`, `status_code` | `error` | any | ≥ 5 in 5 min |
| `packages/tts/src/adapters/*.ts:streamSynthesize` (client disconnect) | `tts.client_disconnect` | `request_id`, `chunk_index`, `bytes_sent` | `debug` | none | n/a |

### Player

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/components/player/Player.tsx` (play) | `player.play` | `request_id`, `document_id`, `source` (`click`|`keyboard`|`autoplay_blocked`) | `info` | `source=autoplay_blocked` rate | > 1% (should be 0 by UI-UX.md §4.4) |
| `apps/web/components/player/Player.tsx` (pause) | `player.pause` | `request_id`, `document_id`, `word_offset`, `duration_ms` | `debug` | none | n/a |
| `apps/web/components/player/Player.tsx` (seek) | `player.seek` | `request_id`, `document_id`, `from_ms`, `to_ms`, `trigger` (`scrubber`\|`click-word`\|`j`\|`k`\|`arrow`) | `debug` | none | n/a |
| `apps/web/components/player/Player.tsx` (speed change) | `player.speed_change` | `request_id`, `document_id`, `from`, `to` | `debug` | none | n/a |
| `apps/web/components/player/Player.tsx` (voice change) | `player.voice_change` | `request_id`, `document_id`, `from_voice_id`, `to_voice_id` | `info` | none | n/a |
| `apps/web/components/player/Player.tsx` (skip filler) | `player.skip_filler` | `request_id`, `document_id`, `skipped_sentences` | `info` | none | n/a |
| `apps/web/components/player/Player.tsx` (resume from position) | `player.resume_from_position` | `request_id`, `document_id`, `word_offset`, `device_id`, `drift_ms` | `info` | `drift_ms > 30_000` rate | > 5% (UI-UX.md §4.3 expects no toast for small drift) |

### Karaoke sync

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `packages/ui/src/primitives/KaraokeHighlighter.tsx` (word advance) | `karaoke.word_advance` | `request_id`, `document_id`, `word_index`, `mark_ms`, `paint_ms`, `drift_ms` | `debug` | `drift_ms > 150` | p95 > 150ms over 5 min |
| `apps/web/components/player/Player.tsx` (drift detection) | `karaoke.drift_detected` | `request_id`, `document_id`, `drift_ms`, `reconciled` | `warn` | `drift_ms > 250` rate | > 1% over 5 min |

### SSE / positions

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/app/api/positions/stream/route.ts` (connect) | `sse.connect` | `request_id`, `user_id_hash`, `document_id`, `client_id` | `info` | concurrent connections | > 10k per user |
| `apps/web/app/api/positions/route.ts` (write) | `sse.position_written` | `request_id`, `user_id_hash`, `document_id`, `word_offset` | `debug` | writes/sec per user | > 1/s sustained |
| `apps/web/app/api/positions/stream/route.ts` (flood detected) | `sse.flooding_db` | `user_id_hash`, `writes_per_min`, `rate_limited` | `warn` | any | ≥ 1 |
| `apps/web/app/api/positions/stream/route.ts` (disconnect) | `sse.disconnect` | `request_id`, `client_id`, `duration_ms`, `reason` | `debug` | none | n/a |
| `apps/web/app/api/positions/stream/route.ts` (reconnect) | `sse.reconnect` | `client_id`, `last_event_id`, `gap_ms` | `info` | `gap_ms > 30_000` rate | > 5% |

### AI

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/app/api/ai/{summary,quiz,recap,ask}/route.ts` (start) | `ai.task_start` | `request_id`, `user_id_hash`, `task` (`summary`\|`quiz`\|`recap`\|`ask`\|`fillers`), `document_id`, `model` | `info` | None | n/a |
| `apps/web/app/api/ai/.../route.ts` (end ok) | `ai.task_complete` | `request_id`, `task`, `model`, `tokens_in`, `tokens_out`, `duration_ms`, `citation_count` | `info` | `duration_ms > 8000` | p95 > 8s |
| `apps/web/app/api/ai/.../route.ts` (retry) | `ai.task_retry` | `request_id`, `task`, `model`, `attempt`, `reason` | `warn` | retries per task | > 2 |
| `apps/web/app/api/ai/.../route.ts` (fallback model) | `ai.model_fallback` | `request_id`, `task`, `from_model`, `to_model`, `reason` | `warn` | fallback rate | > 10% over 10 min |
| `apps/web/app/api/ai/.../route.ts` (citation rule violated) | `ai.citation_missing` | `request_id`, `task`, `claim_index`, `model` | `warn` | rate | > 5% of responses |
| `apps/web/app/api/ai/.../route.ts` (failure) | `ai.task_failed` | `request_id`, `task`, `model`, `error_class`, `attempts` | `error` | any | ≥ 5 in 5 min |

### Podcast

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `services/worker-python/app/tasks/podcast.py:generate_podcast` (stage transition) | `podcast.stage` | `request_id`, `episode_id`, `stage` (`reading_doc`\|`writing_script`\|`casting_voices`\|`producing_audio`\|`completed`\|`failed`), `duration_ms`, `progress_pct` | `info` | stuck in stage | > 5 min in any one stage |
| `services/worker-python/app/tasks/podcast.py:generate_podcast` (script complete) | `podcast.script_complete` | `request_id`, `episode_id`, `line_count`, `speaker_count` | `info` | `line_count < 4` | any (UI-UX.md §7 expects ≥ 2 speakers, realistic count is ≥ 8) |
| `services/worker-python/app/tasks/podcast.py:generate_podcast` (mastered) | `podcast.audio_complete` | `request_id`, `episode_id`, `audio_path`, `size_bytes`, `duration_seconds`, `duration_ms` | `info` | file size mismatch | > 10% off estimate |
| `apps/web/app/api/podcasts/route.ts` (stream start) | `podcast.stream_start` | `request_id`, `user_id_hash`, `episode_id`, `range` | `info` | none | n/a |

### Habit layer

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/lib/habit/streak.ts:increment` | `habit.streak_increment` | `user_id_hash`, `current_days`, `longest_days` | `info` | none | n/a |
| `apps/web/lib/habit/streak.ts:useFreeze` | `habit.streak_freeze_used` | `user_id_hash`, `freezes_remaining`, `missed_date` | `info` | freeze usage | > 3/week per user |
| `apps/web/lib/habit/streak.ts:recover` | `habit.streak_recovered` | `user_id_hash`, `within_24h`, `recovered_days` | `info` | none | n/a |
| `apps/web/lib/habit/xp.ts:award` | `habit.xp_awarded` | `user_id_hash`, `source`, `amount`, `total_xp` | `debug` | none | n/a |
| `apps/web/lib/habit/badge.ts:award` | `habit.badge_awarded` | `user_id_hash`, `badge_id`, `tier` | `info` | none | n/a |
| `apps/web/lib/habit/quest.ts:complete` | `habit.quest_completed` | `user_id_hash`, `quest_id`, `xp_reward` | `info` | none | n/a |

### OCR

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `services/worker-python/app/tasks/ocr.py:ocr_image` (per page) | `ocr.page_complete` | `request_id`, `document_id`, `page_index`, `engine`, `confidence`, `duration_ms` | `debug` | `confidence < 0.6` rate | > 20% of pages |
| `services/worker-python/app/tasks/ocr.py:ocr_image` (fallback to Tesseract) | `ocr.engine_fallback` | `request_id`, `from`, `to`, `reason` | `warn` | fallback rate | > 30% over 10 min |

### Voice cloning

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `apps/web/app/api/voice-clone/route.ts` (consent recorded) | `voice_clone.consent_recorded` | `user_id_hash`, `consent_id`, `version`, `granted` | `info` | `granted=false` rate | n/a (expected for users who decline) |
| `services/worker-python/app/tasks/tts.py:clone_voice` (start) | `voice_clone.clone_start` | `user_id_hash`, `sample_seconds`, `model_version` | `info` | none | n/a |
| `services/worker-python/app/tasks/tts.py:clone_voice` (complete) | `voice_clone.clone_complete` | `user_id_hash`, `voice_id`, `model_version`, `duration_ms` | `info` | `duration_ms > 60_000` | > 1% |
| `services/worker-python/app/tasks/tts.py:clone_voice` (rejected) | `voice_clone.sample_rejected` | `user_id_hash`, `reason` | `warn` | rate | > 50% of submissions (UX issue) |

### Worker / platform

| Function/path | Event | Fields | Level | Anomaly | Alert threshold |
| --- | --- | --- | --- | --- | --- |
| `services/worker-python/app/main.py:/health` | `worker.health` | `service`, `redis_ok`, `db_ok` | `debug` | `redis_ok=false` or `db_ok=false` | ≥ 1 |
| `services/worker-python/app/celery_app.py` (queue depth) | `worker.queue_depth` | `queue`, `depth`, `oldest_age_ms` | `info` | `depth > 1000` or `oldest_age_ms > 300_000` | per [§8.6](#86-alerting) |
| `apps/web/lib/db.ts` (pool) | `db.pool_exhausted` | `active`, `idle`, `waiting` | `error` | `waiting > 0` | sustained 1 min |

---

## 10. Runbooks

For each top alert: **symptoms → likely cause → first 3 things to check → fix path**. Linked from Sentry/Grafana alerts.

### 10.1 TTS provider degraded (high p99 first-chunk latency)

- **Symptoms.** `tts.first_chunk` p99 > 1500ms; `player.time_to_play` regression in RUM; users report "player takes a while to start."
- **Likely cause.** Provider rate-limiting, network blip, or a misconfigured provider key.
- **First 3 things to check.**
  1. Sentry issues for `tts.stream_error` in the last hour — provider and status code distribution.
  2. The provider's status page (ElevenLabs / OpenAI / Azure / Google).
  3. `tts.first_chunk_ms` p99 per `provider` — is one provider bad or all?
- **Fix path.** If single provider: temporarily reweight the router to favor a healthy provider (config flag in `packages/config/src/env.ts`); confirm via the latency dashboard. If all providers: check upstream network egress from Railway; escalate to the platform on-call.

### 10.2 AI provider down (OpenRouter 5xx or per-model errors)

- **Symptoms.** `ai.task_failed` rate spike; users see "Couldn't reach the assistant" toasts; quiz/summary pages show the human error.
- **Likely cause.** OpenRouter incident; specific model unavailable; key quota exceeded.
- **First 3 things to check.**
  1. [OpenRouter status](https://openrouter.ai/status) and the per-model availability table.
  2. `ai.model_fallback` rate — is the fallback model also failing?
  3. `OPENROUTER_API_KEY` validity (last-used timestamp in the dashboard).
- **Fix path.** Promote `OPENROUTER_DEFAULT_MODEL` to a known-healthy model via env, restart the worker. If `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` direct-access overrides are set, swap the per-task model in `services/worker-python/app/tasks/openrouter.py`. Communicate on the in-app banner (`Couldn't reach the assistant — we're working on it`).

### 10.3 SSE position sync flooding DB

- **Symptoms.** Postgres CPU spikes; `sse.flooding_db` events; `db.pool_exhausted` warnings.
- **Likely cause.** A misbehaving client (extension or mobile) is sending position updates without the 1s debounce in `packages/core/src/sync/position-store.ts`.
- **First 3 things to check.**
  1. `sse.position_written` write rate per `user_id_hash` — top 10 offenders.
  2. The corresponding user-agent strings in the access logs.
  3. The `apps/web/middleware.ts` rate-limit hit count for `/api/positions`.
- **Fix path.** Confirm the debounce is in place client-side; if a deploy dropped it, roll back. Add an emergency server-side debounce in `apps/web/app/api/positions/route.ts` (`updatedAt < 1s ago → 200 noop`). Reach out to the offending client app's release channel.

### 10.4 Storage cost spike (podcast volume growth)

- **Symptoms.** `podcast.audio_complete` size_bytes sum per day > 2× baseline; volume utilization alert.
- **Likely cause.** Podcast generation surge (campaign, viral post); broken retry loop doubling writes; a path bug writing whole-doc audio instead of per-line.
- **First 3 things to check.**
  1. Per-episode `size_bytes` distribution — are episodes getting larger, or is count up?
  2. The `services/worker-python/app/tasks/podcast.py` retry path — is it idempotent on `episode_id`?
  3. New voices or styles that change line count (longer scripts).
- **Fix path.** Quarantine episodes > X days old from the hot volume to cold (a separate volume or off-volume); raise the per-episode cap; if a code path is miswriting, fix and re-emit.

### 10.5 Privy outage (fallback to dev-mode auth)

- **Symptoms.** `auth.token_verify_failed` rate spike; users report "stuck on sign-in."
- **Likely cause.** Privy incident; JWT verification failing.
- **First 3 things to check.**
  1. Privy status page.
  2. The verifier's recent changes (`apps/web/lib/privy-verify.ts`) — did the swap-in of `PrivyClient.utils().auth().verifyAccessToken` ship?
  3. The `auth.dev_bypass_used` log — must be 0 in prod. If > 0, the fallback was hit by accident.
- **Fix path.** **Do not** enable dev-bypass in prod. Wait for Privy to recover; the BFF returns 401 with a "Sign-in temporarily unavailable — retry" UI. If Privy is down for > 30 min, escalate to the auth on-call.

### 10.6 Postgres connection pool exhausted

- **Symptoms.** `db.pool_exhausted` warnings; BFF routes return 500; `p100` query latency > 5s.
- **Likely cause.** Long-running query (full-table scan on `Document.segmentTree`); connection leak from a missing `prisma.$disconnect()`; Celery worker opening too many connections.
- **First 3 things to check.**
  1. `pg_stat_activity` — top queries by duration and by connection count.
  2. The Celery worker count vs Postgres `max_connections` (Railway default is 100).
  3. Recent Prisma migrations that may have created a missing index.
- **Fix path.** Kill the long queries (`pg_terminate_backend`); reduce worker concurrency; add the missing index. If sustained, scale up Postgres.

### 10.7 Redis queue backlog

- **Symptoms.** `worker.queue_depth > 1000`; `parse`/`ai`/`tts` queues growing; users see stuck imports.
- **Likely cause.** Worker down or scaled down; Celery concurrency too low; a task is hanging.
- **First 3 things to check.**
  1. Worker process count on Railway.
  2. The slowest task in `worker.queue_depth.oldest_age_ms` — which queue and which task?
  3. Recent deploys to `services/worker-python` that may have introduced a hang.
- **Fix path.** Restart the worker process; if the oldest task is a hang, drain the queue (`celery purge -Q <queue>`) and replay from the latest `ImportJob` row. If sustained, scale worker concurrency.

### 10.8 Web Audio engine failure on Safari

- **Symptoms.** `player.play` succeeds in Chrome/Firefox but `AudioContext` throws or `audio.play()` returns a rejected promise on Safari (macOS or iOS).
- **Likely cause.** Missing user gesture before `AudioContext` instantiation; `audio.play()` called from an event handler that's not in the gesture chain; iOS background-audio entitlement missing.
- **First 3 things to check.**
  1. The exact call site in `packages/ui/src/primitives/Player.tsx` — is `new AudioContext()` inside the click handler?
  2. The Info.plist for the iOS app (`UIBackgroundModes: ["audio"]`) for mobile.
  3. Safari's autoplay policy — silent audio is allowed, but the first `audio.play()` must be in a gesture.
- **Fix path.** Confirm the gesture chain; add a `silent.mp3` pre-warm on first user gesture; for iOS, set the background-audio entitlement. Document the iOS quirk in `docs/runbooks/safari-webaudio.md`.

---

## 11. Production readiness checklist (per release)

Go / no-go gate. Every box must be green before a release train deploys.

- [ ] **Critical tests green.** `pnpm test` (all packages), `pnpm test:e2e` (Playwright), `pytest` (Python worker) all pass on `main`.
- [ ] **Performance budgets green.** Lighthouse CI, time-to-play, INP, karaoke jitter, bundle size, CLS, offline — all within [§4](#4-performance-budgets-ui-ux-md-10) thresholds on the last 3 builds.
- [ ] **Error rate < threshold in staging.** BFF 5xx rate < 0.1%; worker task failure rate < 1% over the last 24h.
- [ ] **Sentry release tagged.** The git SHA is associated; the previous release's "Suspected Releases" view is clean (no new regressions introduced by this release).
- [ ] **Runbooks up-to-date.** Any new alert has a runbook; any updated alert has a diff in `/docs/runbooks/`.
- [ ] **Feature flags set.** All flags in the release manifest are in their intended state for the rollout percentage.
- [ ] **On-call rotation covered.** PagerDuty/Opsgenie has primary + secondary for the release window; no holidays in the 48h post-deploy.
- [ ] **RUM baseline captured.** `web-vitals` distributions for LCP / INP / CLS / time-to-play are snapshotted pre-deploy; the post-deploy comparison is on a dashboard.
- [ ] **Perf budget dashboard up.** Grafana panel for each [§4](#4-performance-budgets-ui-ux-md-10) budget is live and pinned.
- [ ] **No P0 bugs older than 7 days.** Linear/Jira filter for `priority = P0 AND age > 7d` returns 0 issues.
- [ ] **Accessibility sweep signed off.** NVDA + VoiceOver sweeps complete for affected surfaces; axe-core passes on every route touched by the release.
- [ ] **Habits messaging reviewed.** Any change to streak / XP / leaderboard copy is reviewed against UI-UX.md §8 ("pressure-without-shame"); no anxious-red tokens introduced.
- [ ] **Privacy review.** Any new log field has been audited against §8.7's DO-NOT-log list; Sentry `beforeSend` scrubber updated.
- [ ] **Open questions resolved.** Any item in [§13](#13-open-questions) tagged as release-blocking is closed or deferred explicitly.

---

## 12. Test data & fixtures

Lives under `tests/fixtures/` (TS) and `services/worker-python/tests/fixtures/` (Python). Versioned with the repo.

- **Seed users** (`tests/fixtures/users.json`):
  - `regular` — Privy `did:privy:regular…`, `isPremium=false`.
  - `premium` — `isPremium=true`, has a `Consent { kind: "voice_clone", granted: true }`.
  - `admin` — `isPremium=true`, has `Consent { kind: "leaderboards", granted: false }` (private mode).
- **Sample docs** (committed under `tests/fixtures/docs/`):
  - `short.md` — 200 words, used in unit tests.
  - `medium.pdf` — 10 pages, 2 columns, has headings + lists.
  - `medium.docx` — 20 pages, headings + tables + code blocks.
  - `medium.epub` — 3 chapters, 60k words.
  - `scanned.pdf` — 5 pages, 300 DPI, English (high OCR confidence).
  - `scanned-noisy.jpg` — phone photo, low OCR confidence.
- **Voice samples for cloning:** `tests/fixtures/voices/sample-30s.wav` (minimum length), `sample-3min.wav` (good length), `sample-with-noise.wav` (rejected).
- **Large-document fixtures:** `tests/fixtures/large/100k.md` (for builder perf), `tests/fixtures/large/500k.epub` (for SSE stress).
- **Bad-input fixtures:** `corrupt.pdf` (truncated bytes), `empty.txt`, `ocr-garbage.jpg` (all noise), `url-404.html`, `url-paywall.html`.
- **Edge-case docs:**
  - `rtl.md` — right-to-left Arabic prose.
  - `mixed-lang.md` — English + Spanish + Japanese in one doc.
  - `code-blocks.md` — heavy code with ```fences```.
  - `math.md` — LaTeX equations (`$E = mc^2$`).
  - `tables-and-lists.md` — complex nested lists.
- **Podcast fixtures:** a manifest at `tests/fixtures/podcasts/manifest.json` with a known line list + expected duration.
- **Habit fixtures:** seed `Streak`, `XpEvent`, `Badge`, `Quest`, `LeaderboardLeague`, `DailyGoal` rows for the `regular` user to exercise the leaderboard + weekly digest.
- **PII / privacy fixtures:** an anonymized sample of production-shaped logs (`tests/fixtures/logs/sample.jsonl`) used by the log-scan test.

---

## 13. Open questions

Ambiguities that need a decision before tests can be written. Tagged `[BLOCKING]` if the release checklist cannot pass without an answer.

1. **[BLOCKING] Browser matrix for tier 1.** Is `Firefox` tier 1 (must-pass on every release) or tier 2? UI-UX.md doesn't specify; Firefox lacks reliable Web Speech API on desktop which affects [§2.10](#210-voice-assistant). _Decision needed: keep Firefox at tier 2 unless we drop voice-in on Firefox._
2. **Sentry data residency.** Is the Sentry org in EU/US/self-hosted? Affects what we can log per [§8.7](#87-privacy--what-we-do-and-do-not-log). _Default assumed: US region, US data residency._
3. **OTLP collector host.** Do we run our own collector on Railway, or use Honeycomb / Grafana Cloud? Affects the dashboards in [§4](#4-performance-budgets-ui-ux-md-10). _Default assumed: Honeycomb free tier until cost justifies dedicated._
4. **Podcast volume cap.** What is the per-user / per-episode size cap before [§10.4](#104-storage-cost-spike-podcast-volume-growth) fires? _Default assumed: 100MB per episode, 5GB per user._
5. **Streak freeze weekly cap.** UI-UX.md §8 says "1/week base + bonus from milestones" — what's the bonus formula? _Default assumed: +1 freeze at 7-day, 30-day, 100-day streaks; max 3 active at any time._
6. **Mobile on-device TTS model.** Is it Piper, Kokoro, or both? Affects [§2.16](#216-mobile-expo--react-native). _Default assumed: Piper for Phase 6, Kokoro evaluated in Phase 7._
7. **Voice cloning provider.** XTTS-v2 (per the plan) vs ElevenLabs Instant Voice Cloning vs Resemble.ai? Affects §2.12 and the worker's TTS module. _Default assumed: XTTS-v2 for self-hosted privacy; ElevenLabs IVC as a fallback for users who opt in._
8. **OpenRouter model defaults per task.** The plan says "cheap model for summary, frontier model for podcast script" — what's the actual mapping? _Default assumed: `openai/gpt-4o-mini` for summary/recap/fillers; `anthropic/claude-3-5-sonnet` for ask/podcast script; configurable via env._
9. **RUM sampling rate.** `web-vitals` to Sentry — 100% or sampled? Affects [§8.4](#84-real-user-monitoring-rum). _Default assumed: 10% sampling in prod, 100% in staging._
10. **Rate-limit thresholds.** Per-IP or per-user? What values? Affects [§7](#7-security--privacy-test-cases). _Default assumed: per-user via the BFF middleware; `/api/import` 10/min, `/api/tts` 60/min, `/api/positions` 120/min._
11. **What counts as "mid-flow" for non-negotiable #4.** Is a coachmark step on first session a mid-flow interruption if it's never shown again? _Default assumed: no — coachmarks are onboarding, not playback._
12. **Dyslexia review cadence.** UI-UX.md §9 says "manual, once per release" — is that every minor or only major? _Default assumed: every release that touches reader primitives._
13. **PDF generator for the doc fixtures.** `tests/fixtures/docs/medium.pdf` needs a stable source. Are we committing the binary (and re-generating via a script on demand) or generating at test time from a Markdown source? _Default assumed: commit the binary for stability; document the regeneration command in the fixture's README._
14. **CI provider.** GitHub Actions (per [§4](#4-performance-budgets-ui-ux-md-10) sketch) vs Railway-native vs something else? _Default assumed: GitHub Actions for now; revisit if Railway's CI matures._

---

*This is a spec for what to test, not the test files themselves. Every entry above should be implementable as one or more vitest / Playwright / pytest files co-located with the code under test, or as a manual checklist linked from `/docs/runbooks/`.*
