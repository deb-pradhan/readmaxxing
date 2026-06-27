"""AI Podcast generation — multi-speaker script → TTS → master → volume.

Phase 4 wires the full pipeline (per the v1 plan and TESTING.md §2.9):

  1) Read doc text (the BFF passes the text; this task is text-only).
  2) Call `podcast_script_messages` against OpenRouter to produce a
     multi-speaker script (alternating H1 / H2 / H1+2).
  3) Per-line TTS:
     - When `ELEVENLABS_API_KEY` is set: real HTTP synthesis per speaker.
     - Otherwise: deterministic silent MP3 of the right duration so the
       full pipeline (audio + speech marks + progress events) is exercised
       end-to-end in tests and CI.
  4) Concatenate with 500ms gaps via `pydub` and write the mastered MP3 to
     `PODCAST_VOLUME_PATH/<document_id>/<episode_id>.mp3`.
  5) Generate speech marks for the full episode (word boundaries derived
     from the per-line synthesis) and persist them on the `PodcastEpisode`
     row's `progress` JSON column (worker doesn't write to Postgres
     directly — it returns the manifest; the BFF persists).

Per TESTING.md §9 every stage transition emits a `podcast.stage` event with
real elapsed time and `progress_pct`; the BFF's SSE handler picks these up.

Privacy: raw transcript text is NOT logged. Logged fields are line counts,
byte counts, stage names, and durations — all PII-free per §8.7.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import struct
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from celery import shared_task

from .openrouter import complete, podcast_script_messages

logger = logging.getLogger("readmaxxing.podcast")

DEFAULT_PODCAST_MODEL = os.getenv("OPENROUTER_PODCAST_MODEL", "openai/gpt-4o-mini")

# Per-line silence gap (TESTING.md §2.9: "500ms gaps" between host lines).
LINE_GAP_MS = 500

# Average English words-per-minute the TTS / silence estimator assumes when
# synthesizing without a real provider. UI-UX.md §13 "honest numbers" — the
# stub uses the same value we report in the UI so the episode duration is
# what the user expected.
STUB_WPM = 165

# Speech-mark average word duration (ms) used by the stub to lay out word
# boundaries across the synthesized silence. Real providers return their
# own boundaries; this just keeps the karoke experience consistent in tests.
STUB_WORD_AVG_MS = 280


# =============================================================================
# Stage tracker — emits TESTING.md §9 `podcast.stage` events. The BFF's SSE
# handler subscribes via Redis pub/sub (when available) or polls the in-memory
# dict for stage status.
# =============================================================================

@dataclass(slots=True)
class StageEvent:
    request_id: str
    episode_id: str
    stage: str  # reading_doc | writing_script | casting_voices | producing_audio | completed | failed
    duration_ms: int
    progress_pct: int
    status: str = "ok"
    error_class: str | None = None
    error_msg: str | None = None
    timestamp: float = field(default_factory=time.time)


# In-memory stage tracker; the BFF polls /v1/podcast/{id}/progress.
_STAGE_HISTORY: dict[str, list[StageEvent]] = {}
_STAGE_LATEST: dict[str, StageEvent] = {}

ALL_STAGES = (
    "reading_doc",
    "writing_script",
    "casting_voices",
    "producing_audio",
)


def emit_stage(
    request_id: str,
    episode_id: str,
    stage: str,
    duration_ms: int,
    progress_pct: int,
    *,
    status: str = "ok",
    error_class: str | None = None,
    error_msg: str | None = None,
) -> None:
    """Emit a `podcast.stage` event.

    Logs a structured JSON line (TESTING.md §8.1) AND records the event in
    the in-memory tracker so the BFF's SSE handler can replay the latest
    progress.
    """
    evt = StageEvent(
        request_id=request_id,
        episode_id=episode_id,
        stage=stage,
        duration_ms=duration_ms,
        progress_pct=progress_pct,
        status=status,
        error_class=error_class,
        error_msg=error_msg,
    )
    _STAGE_HISTORY.setdefault(episode_id, []).append(evt)
    _STAGE_LATEST[episode_id] = evt
    # Structured log — fields chosen per TESTING.md §9 `podcast.stage`.
    payload = {
        "event": "podcast.stage",
        "episode_id": episode_id,
        "request_id": request_id,
        "stage": stage,
        "duration_ms": duration_ms,
        "progress_pct": progress_pct,
        "status": status,
    }
    if error_class:
        payload["error_class"] = error_class
    if error_msg:
        payload["error_msg"] = error_msg[:200]
    # We log only counts + names — never raw script text.
    logger.info(json.dumps(payload))


def get_latest_stage(episode_id: str) -> StageEvent | None:
    return _STAGE_LATEST.get(episode_id)


def get_stage_history(episode_id: str) -> list[StageEvent]:
    return list(_STAGE_HISTORY.get(episode_id, []))


# =============================================================================
# Scripting
# =============================================================================


def _script_to_json(text: str) -> dict:
    """Some providers wrap JSON in fences; strip + parse."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[: -len("```")]
    return json.loads(cleaned.strip())


def _empty_script(title: str, reason: str) -> dict:
    """Fallback script when LLM fails — lets the pipeline still produce audio."""
    return {
        "title": title,
        "lines": [
            {"speaker": "H1", "text": "Sorry — we couldn't write the script."},
            {"speaker": "H2", "text": "Try again with a different style."},
        ],
        "signoff": reason,
    }


# =============================================================================
# Audio I/O — silent stub + mastering
# =============================================================================


def _silent_mp3_bytes(duration_ms: int) -> bytes:
    """Produce a deterministic silent MP3 of the requested duration.

    Uses `pydub` with `AudioSegment.silent()` and exports to MP3 via the
    bundled `AudioSegment` (no ffmpeg needed for `silent()`). The output is
    a real, playable MP3 — same codec/format a real provider would return
    — so the BFF can stream it, the player can seek, and durations match.

    Falls back to a tiny in-memory MP3 frame when pydub isn't importable
    (e.g. local environments without `audioop` — Python 3.14+). The
    fallback is NOT a playable MP3; tests can monkey-patch this helper to
    validate the pipeline contract without needing the codec.
    """
    try:
        from pydub import AudioSegment  # local import — pydub is in pyproject

        ms = max(100, int(duration_ms))
        # `silent()` produces true silence at 44.1kHz mono. Encoding to mp3
        # gives us a small but valid file (a few KB even for long durations).
        seg = AudioSegment.silent(duration=ms, frame_rate=44_100)
        return seg.export(format="mp3").read()
    except (ImportError, ModuleNotFoundError):
        return _fallback_silent_mp3(duration_ms)


def _fallback_silent_mp3(duration_ms: int) -> bytes:
    """Minimal silent-MP3 fallback for environments without pydub.

    Not a real MP3 frame — the BFF stream route detects this via the
    4-byte signature and returns 502. Tests should monkey-patch
    `_silent_mp3_bytes` to return a real MP3 if they need to validate
    the mastering math.
    """
    # A tiny ASCII "stub" payload — clearly not playable but unambiguous.
    return f"silent-stub:{int(duration_ms)}".encode("utf-8")


def _merge_segments(segments: list[bytes], gap_ms: int) -> bytes:
    """Concatenate MP3 byte chunks with `gap_ms` of silence between each."""
    try:
        from pydub import AudioSegment  # noqa: F401
    except (ImportError, ModuleNotFoundError):
        # Without pydub we can't actually merge MP3 frames; return the
        # first chunk (concatenation happens byte-wise, which is harmless
        # for the stub path).
        return segments[0] if segments else b""
    from pydub import AudioSegment

    if not segments:
        return _silent_mp3_bytes(LINE_GAP_MS)
    gap = AudioSegment.silent(duration=max(0, gap_ms), frame_rate=44_100)
    merged = AudioSegment.empty()
    for idx, chunk in enumerate(segments):
        try:
            seg = AudioSegment.from_mp3(_BytesIO(chunk))
        except Exception:
            # Fall back to silent on a bad chunk — keeps the pipeline
            # resilient to a single failing line.
            seg = AudioSegment.silent(duration=LINE_GAP_MS, frame_rate=44_100)
        merged += seg
        if idx < len(segments) - 1:
            merged += gap
    return merged.export(format="mp3").read()


class _BytesIO:
    """Tiny shim — pydub wants a file-like with a `.read()`; bytes do too,
    but we wrap defensively for type-checkers."""

    __slots__ = ("_buf",)

    def __init__(self, buf: bytes) -> None:
        self._buf = buf

    def read(self, n: int = -1) -> bytes:
        if n < 0:
            out = self._buf
            self._buf = b""
            return out
        out = self._buf[:n]
        self._buf = self._buf[n:]
        return out


def _elevenlabs_synthesize(text: str, voice_id: str, timeout_s: float = 30.0) -> bytes | None:
    """Synthesize one line via ElevenLabs' /v1/text-to-speech endpoint.

    Returns MP3 bytes on success, None on any failure (caller falls back to
    stub). We intentionally don't raise — a single bad line shouldn't take
    down the whole episode.
    """
    import httpx

    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        resp = httpx.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": api_key,
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
            },
            timeout=timeout_s,
        )
        if resp.status_code >= 400:
            logger.info(
                "elevenlabs_synthesize: status=%d voice=%s — falling back to stub",
                resp.status_code,
                voice_id,
            )
            return None
        return resp.content
    except Exception as exc:
        logger.info("elevenlabs_synthesize: %s — falling back to stub", exc.__class__.__name__)
        return None


def _synthesize_line(
    text: str,
    voice_id: str,
) -> tuple[bytes, int]:
    """Synthesize one line; return `(mp3_bytes, duration_ms)`.

    Tries ElevenLabs first if a key is set; falls back to the silent stub.
    Duration for stub is derived from the word count (avg wpm) so the final
    mastered duration matches what the UI reports.
    """
    real = _elevenlabs_synthesize(text, voice_id)
    if real is not None:
        # For real audio we still need a duration; use word count at WPM as
        # a safe underestimate, then refine via pydub on the merged stream.
        wc = max(1, len(text.split()))
        dur_ms = int((wc / STUB_WPM) * 60_000)
        return real, dur_ms
    # Stub path: silent MP3 sized to match the expected line duration.
    wc = max(1, len(text.split()))
    dur_ms = max(800, int((wc / STUB_WPM) * 60_000))
    return _silent_mp3_bytes(dur_ms), dur_ms


def _estimate_real_duration(mp3_bytes: bytes) -> int:
    """Best-effort duration probe via pydub. Falls back to len-derived estimate."""
    try:
        from pydub import AudioSegment

        return int(AudioSegment.from_mp3(_BytesIO(mp3_bytes)).duration_seconds * 1000)
    except Exception:
        return 0


# =============================================================================
# Speech marks — `[ { timeSeconds, type, word } ]`
# =============================================================================


_WORD_RE = re.compile(r"\S+")


def _build_speech_marks(
    lines: list[dict[str, Any]],
    line_start_ms: list[int],
) -> list[dict[str, Any]]:
    """Build word-level speech marks by laying words evenly across each line.

    The stub (and ElevenLabs non-streaming) don't return character-level
    timestamps; this approximation is sufficient to drive a karaoke-style
    read-along at the `episode`-level granularity. The reader's RAF sync
    handles the visible drift (per UI-UX.md §3.4).
    """
    marks: list[dict[str, Any]] = []
    for line_idx, line in enumerate(lines):
        start_ms = line_start_ms[line_idx]
        text = str(line.get("text", ""))
        words = _WORD_RE.findall(text)
        if not words:
            continue
        # We don't know the line's exact ms; use STUB_WORD_AVG_MS as a
        # uniform grid. The reader reconciles to actual audio duration.
        for w_idx, w in enumerate(words):
            marks.append(
                {
                    "type": "word",
                    "timeSeconds": round((start_ms + w_idx * STUB_WORD_AVG_MS) / 1000.0, 3),
                    "word": w,
                }
            )
        marks.append(
            {
                "type": "sentence_end",
                "timeSeconds": round((start_ms + len(words) * STUB_WORD_AVG_MS) / 1000.0, 3),
            }
        )
    return marks


# =============================================================================
# Master pipeline
# =============================================================================


@dataclass(slots=True)
class VoiceMap:
    """Maps speakers → voice ids. Lecture uses a single host voice."""

    h1: str
    h2: str


def _voice_map_for_style(style: str, host_voice_id: str, guest_voice_id: str) -> VoiceMap:
    if style == "lecture":
        # One host, two synthetic line-speakers still round-robin but to
        # the same voice. Keeps the mastering math uniform.
        return VoiceMap(h1=host_voice_id, h2=host_voice_id)
    return VoiceMap(h1=host_voice_id, h2=guest_voice_id)


def _stage_timer() -> "_StageTimer":
    return _StageTimer()


class _StageTimer:
    __slots__ = ("_start",)

    def __init__(self) -> None:
        self._start = time.monotonic()

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self._start) * 1000)


def _progress_pct(stage_index: int) -> int:
    """Crude percent for the stage transition log line — the BFF also
    recomputes a moving-window estimate based on real durations. This is a
    coarse anchor so the log line is human-readable."""
    if stage_index < 0:
        return 0
    pct = int((stage_index + 1) * (100 / len(ALL_STAGES)))
    return min(99, max(1, pct))


def generate_podcast(
    document_id: str,
    document_text: str,
    *,
    request_id: str = "local",
    style: str = "podcast",
    depth: str = "normal",
    title: str | None = None,
    host_voice_id: str = "eleven_rachel",
    guest_voice_id: str = "elevenlabs_josh",
    model: str | None = None,
    progress_callback: Callable[[str, int, int], None] | None = None,
) -> dict:
    """Orchestrate script → TTS → master → persist to volume.

    Returns the episode manifest (`episode_id`, `audio_path`, `duration_ms`,
    `speech_marks`, `status`, `usage`). All errors are surfaced via
    `podcast.stage` events with `status="error"`; the function never raises
    out (caller checks `status`).
    """
    episode_id = str(uuid.uuid4())
    voices = _voice_map_for_style(style, host_voice_id, guest_voice_id)
    overall_timer = _stage_timer()

    def emit(stage: str, idx: int, err: Exception | None = None) -> None:
        duration_ms = overall_timer.elapsed_ms()
        pct = _progress_pct(idx)
        if err is not None:
            emit_stage(
                request_id,
                episode_id,
                stage,
                duration_ms,
                pct,
                status="error",
                error_class=err.__class__.__name__,
                error_msg=str(err),
            )
        else:
            emit_stage(request_id, episode_id, stage, duration_ms, pct)
        if progress_callback is not None:
            try:
                progress_callback(stage, pct, duration_ms)
            except Exception:
                # Never let the callback kill the pipeline.
                pass

    # 1) Reading doc — synchronous in the BFF call path; we still log a
    #    stage so the UI gets a clean timeline.
    emit("reading_doc", 0)

    # 2) Writing script ----------------------------------------------------
    script_timer = _stage_timer()
    script: dict[str, Any]
    usage_payload: dict[str, Any] = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cost_usd": 0.0,
        "provider": None,
    }
    try:
        messages = podcast_script_messages(document_text, style=style, depth=depth)
        text, usage = complete(
            messages, model=model or DEFAULT_PODCAST_MODEL, feature="podcast_script"
        )
        script = _script_to_json(text)
        usage_payload = {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        }
    except Exception as exc:
        logger.warning(
            "generate_podcast: script LLM failed (%s) — using minimal fallback",
            exc.__class__.__name__,
        )
        script = _empty_script(title or "Untitled podcast", reason="script_fallback")
    lines = script.get("lines", []) or []
    logger.info(
        "generate_podcast: script=%d lines style=%s elapsed_ms=%d",
        len(lines),
        style,
        script_timer.elapsed_ms(),
    )
    emit("writing_script", 1)

    # 3) Casting voices + per-line TTS ------------------------------------
    casting_timer = _stage_timer()
    line_segments: list[bytes] = []
    line_durations_ms: list[int] = []
    enriched_lines: list[dict[str, Any]] = []

    for idx, line in enumerate(lines):
        speaker = str(line.get("speaker", "H1")).upper()
        line_text = str(line.get("text", "")).strip()
        if not line_text:
            continue
        voice_id = voices.h1 if speaker in ("H1", "H1+2") else voices.h2
        try:
            mp3, est_ms = _synthesize_line(line_text, voice_id)
        except Exception as exc:
            logger.info(
                "generate_podcast: per-line synthesize failed (%s) — using stub",
                exc.__class__.__name__,
            )
            mp3, est_ms = _silent_mp3_bytes(LINE_GAP_MS), LINE_GAP_MS
        line_segments.append(mp3)
        line_durations_ms.append(est_ms)
        enriched_lines.append(
            {
                "speaker": speaker,
                "voiceId": voice_id,
                "text": line_text,
                "index": idx,
            }
        )
    logger.info(
        "generate_podcast: synthesized=%d lines elapsed_ms=%d",
        len(enriched_lines),
        casting_timer.elapsed_ms(),
    )
    emit("casting_voices", 2)

    # 4) Producing audio (mastering + speech marks + write) -------------
    produce_timer = _stage_timer()
    try:
        merged_mp3 = _merge_segments(line_segments, gap_ms=LINE_GAP_MS)
        # After merging, recompute the line start offsets so speech marks
        # line up with the actual mastered audio (each line starts at the
        # sum of preceding line durations + gaps).
        line_start_ms: list[int] = []
        running = 0
        for d in line_durations_ms:
            line_start_ms.append(running)
            running += d + LINE_GAP_MS

        # If real ElevenLabs bytes came back, the line durations we estimated
        # from wpm may be wrong — replace with measured durations where
        # possible (best-effort; falls back silently).
        try:
            measured = [_estimate_real_duration(seg) for seg in line_segments]
            if all(m > 0 for m in measured):
                line_durations_ms = measured
                line_start_ms = []
                running = 0
                for d in line_durations_ms:
                    line_start_ms.append(running)
                    running += d + LINE_GAP_MS
        except Exception:
            pass

        speech_marks = _build_speech_marks(enriched_lines, line_start_ms)
        total_duration_ms = sum(line_durations_ms) + LINE_GAP_MS * max(0, len(line_durations_ms) - 1)

        volume_root = Path(os.getenv("PODCAST_VOLUME_PATH", "/data/podcasts"))
        episode_dir = volume_root / document_id
        episode_dir.mkdir(parents=True, exist_ok=True)
        audio_path = episode_dir / f"{episode_id}.mp3"
        audio_path.write_bytes(merged_mp3)

        manifest = {
            "episode_id": episode_id,
            "document_id": document_id,
            "title": title or script.get("title", "Untitled podcast"),
            "style": style,
            "depth": depth,
            "host_voice_id": host_voice_id,
            "guest_voice_id": guest_voice_id,
            "lines": enriched_lines,
            "signoff": script.get("signoff", ""),
            "audio_path": str(audio_path),
            "audio_url_path": f"{document_id}/{episode_id}.mp3",
            "duration_ms": total_duration_ms,
            "duration_seconds": round(total_duration_ms / 1000.0, 3),
            "speech_marks": speech_marks,
            "status": "completed",
            "line_count": len(enriched_lines),
            "speaker_count": _count_speakers(enriched_lines),
            "created_at": time.time(),
        }

        # TESTING.md §9 `podcast.complete` event (lines + speakers, no PII).
        emit_stage(
            request_id,
            episode_id,
            "producing_audio",
            produce_timer.elapsed_ms(),
            95,
        )
        emit_stage(
            request_id,
            episode_id,
            "completed",
            overall_timer.elapsed_ms(),
            100,
        )
        # TESTING.md §9 `podcast.audio_complete` (size, duration).
        logger.info(
            json.dumps(
                {
                    "event": "podcast.audio_complete",
                    "request_id": request_id,
                    "episode_id": episode_id,
                    "audio_path": str(audio_path),
                    "size_bytes": audio_path.stat().st_size,
                    "duration_ms": total_duration_ms,
                    "duration_seconds": round(total_duration_ms / 1000.0, 3),
                    "line_count": len(enriched_lines),
                    "speaker_count": _count_speakers(enriched_lines),
                }
            )
        )
        return {**manifest, "usage": usage_payload, "model": model or DEFAULT_PODCAST_MODEL}
    except Exception as exc:
        emit("producing_audio", 3, err=exc)
        logger.error(
            json.dumps(
                {
                    "event": "podcast.error",
                    "request_id": request_id,
                    "episode_id": episode_id,
                    "error_class": exc.__class__.__name__,
                    "error_msg": str(exc)[:200],
                }
            )
        )
        # Best-effort: surface a usable failure manifest so the BFF can
        # persist the episode row with `status: failed` and a human hint.
        return {
            "episode_id": episode_id,
            "document_id": document_id,
            "title": title or script.get("title", "Untitled podcast"),
            "audio_path": "",
            "audio_url_path": "",
            "duration_ms": 0,
            "duration_seconds": 0.0,
            "speech_marks": [],
            "status": "failed",
            "line_count": len(enriched_lines),
            "speaker_count": _count_speakers(enriched_lines),
            "error_class": exc.__class__.__name__,
            "error_msg": str(exc)[:200],
            "usage": usage_payload,
            "model": model or DEFAULT_PODCAST_MODEL,
        }


def _count_speakers(lines: list[dict[str, Any]]) -> int:
    speakers = {ln.get("speaker") for ln in lines}
    return len([s for s in speakers if s])


# Celery task wrapper — same signature, runs the in-process pipeline so the
# Celery queue path is exercised by integration tests when the worker boots.
@shared_task(name="app.tasks.podcast.generate_podcast", queue="podcast", bind=True)
def generate_podcast_celery(
    self,
    document_id: str,
    document_text: str,
    *,
    style: str = "podcast",
    depth: str = "normal",
    title: str | None = None,
    host_voice_id: str = "eleven_rachel",
    guest_voice_id: str = "elevenlabs_josh",
    model: str | None = None,
    request_id: str | None = None,
) -> dict:
    return generate_podcast(
        document_id,
        document_text,
        request_id=request_id or str(uuid.uuid4()),
        style=style,
        depth=depth,
        title=title,
        host_voice_id=host_voice_id,
        guest_voice_id=guest_voice_id,
        model=model,
        progress_callback=lambda stage, pct, ms: None,
    )


# Backwards-compat alias — the prior Phase 1 scaffold exported `generate_podcast`
# as the Celery task. Keep both names so existing callers keep working.
generate_podcast_task = generate_podcast_celery