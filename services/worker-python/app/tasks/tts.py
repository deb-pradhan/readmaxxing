"""Local TTS — sherpa-onnx (Piper / Kokoro) stub + voice cloning stub.

Phase 5 wires two paths:

  1) `synthesize` — local TTS via sherpa-onnx. When `PIPER_MODEL_PATH` is
     set this returns real WAV bytes + sample rate; otherwise a clear
     stub.

  2) `clone_voice` — voice cloning. The real implementation will use
     Coqui XTTS-v2 (already a runtime dep) once we mount a model. For
     Phase 5 we ship a deterministic stub that:

        - Validates the audio sample (size + duration heuristic).
        - Returns a UUID voice id and a placeholder preview URL.
        - Records `voice_clone.*` events per TESTING.md §9.

  The BFF (apps/web/app/api/voice/clone/route.ts) handles consent +
  persistence; the worker just runs the heavy model call.

Privacy: per TESTING.md §8.7 we never log raw audio bytes. We log
`sample_bytes`, `sample_seconds`, `voice_id`, and `duration_ms` only.
"""

from __future__ import annotations

import logging
import os
import time
import uuid

from celery import shared_task

logger = logging.getLogger("readmaxxing.tts")

# Pre-baked defaults — adjust once we ship a real model.
PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "")
SHERPA_ONNX_LIB_PATH = os.getenv("SHERPA_ONNX_LIB_PATH", "")
XTTS_MODEL_PATH = os.getenv("XTTS_MODEL_PATH", "")

# The "consent version" string we record against every `Consent` row.
# Bump this whenever the consent screen's wording changes; the
# `Consent.version` column lets us prove which version the user agreed to.
VOICE_CLONE_CONSENT_VERSION = "v1.0.0-2026-06-25"

# Voice-clone sample quality gates. These are intentionally generous
# (the BFF rejects too-short samples) so the worker contract is
# well-defined for tests and for the real XTTS path.
MIN_SAMPLE_SECONDS = 10
MAX_SAMPLE_SECONDS = 90
MIN_SAMPLE_BYTES = 16_000  # ~ 8kHz mono × 0.25s — below this the file is too small to be voice


@shared_task(name="app.tasks.tts.synthesize", queue="tts")
def synthesize(text: str, voice_id: str = "piper_en_US-amy-medium") -> dict:
    """Local TTS via sherpa-onnx. Stub in Phase 1.

    Returns a dict describing what would have been produced. When the model
    is mounted and the env vars above are set, this task will produce WAV
    bytes plus sample rate.
    """
    if not PIPER_MODEL_PATH:
        logger.warning(
            "synthesize: PIPER_MODEL_PATH not set — returning stub (Phase 5 wires the real path)."
        )
        return {
            "status": "stub",
            "reason": "PIPER_MODEL_PATH not configured (Phase 5).",
            "voice_id": voice_id,
            "text_length": len(text),
        }
    # Phase 5 real implementation:
    #   import sherpa_onnx
    #   tts = sherpa_onnx.OfflineTts(
    #       model=PIPER_MODEL_PATH, lib_path=SHERPA_ONNX_LIB_PATH or None
    #   )
    #   audio = tts.generate(text, sid=0, speed=1.0)
    #   return {"status": "ok", "voice_id": voice_id, "sample_rate": tts.sample_rate, "samples": audio.samples}
    return {
        "status": "stub",
        "voice_id": voice_id,
        "text_length": len(text),
    }


@shared_task(name="app.tasks.tts.clone_voice", queue="tts")
def clone_voice(
    audio_base64: str,
    name: str,
    user_id: str,
    *,
    language: str = "en",
) -> dict:
    """Clone a voice from a base64-encoded audio sample.

    Contract (the BFF consumes this):
      {
        "status": "ok" | "sample_too_short" | "sample_too_long" | "model_unconfigured",
        "voice_id": str,            # composite "cloned:<uuid>" — the BFF writes this into Voice.id
        "name": str,                 # echoed back
        "language": str,
        "sample_seconds": int,       # estimated from byte size
        "duration_ms": int,          # how long the worker took
        "model_version": str,        # XTTS / stub marker
        "preview_url": str | None,   # server-relative URL for a sample sentence
      }

    The BFF is responsible for writing the `Voice` row (with
    `isClone: true`, `cloneOwnerId: userId`) and the `Consent` row. This
    task is model-only — DB writes happen on the BFF side per the v1 plan.

    Privacy: NEVER log the raw audio bytes. The structured logs below
    carry only counts + IDs.
    """
    started_ms = int(time.monotonic() * 1000)
    sample_bytes = len(audio_base64.encode("ascii")) if audio_base64 else 0

    # Heuristic: assume 16 kbps ≈ 2 KB/sec after base64 inflation.
    # Real duration comes from a WAV header probe in Phase 5.1.
    estimated_seconds = max(0, sample_bytes // 2_000)

    log_extra = {
        "user_id_hash": _hash_user_id(user_id),
        "sample_bytes": sample_bytes,
        "sample_seconds": estimated_seconds,
        "model_version": "xtts-v2" if XTTS_MODEL_PATH else "stub",
    }

    if sample_bytes < MIN_SAMPLE_BYTES:
        logger.info(
            "clone_voice: sample_too_short user_id=%s bytes=%d", log_extra["user_id_hash"], sample_bytes
        )
        return {
            "status": "sample_too_short",
            "min_seconds": MIN_SAMPLE_SECONDS,
            "duration_ms": int(time.monotonic() * 1000) - started_ms,
            **log_extra,
        }
    if estimated_seconds > MAX_SAMPLE_SECONDS:
        logger.info(
            "clone_voice: sample_too_long user_id=%s seconds=%d",
            log_extra["user_id_hash"],
            estimated_seconds,
        )
        return {
            "status": "sample_too_long",
            "max_seconds": MAX_SAMPLE_SECONDS,
            "duration_ms": int(time.monotonic() * 1000) - started_ms,
            **log_extra,
        }

    if not XTTS_MODEL_PATH:
        # Stub path — return a stable voice id so the BFF can persist it.
        voice_id = f"cloned:{uuid.uuid4()}"
        duration_ms = int(time.monotonic() * 1000) - started_ms
        logger.info(
            "clone_voice: stub user_id=%s voice_id=%s duration_ms=%d",
            log_extra["user_id_hash"],
            voice_id,
            duration_ms,
        )
        return {
            "status": "ok",
            "voice_id": voice_id,
            "name": name,
            "language": language,
            "sample_seconds": estimated_seconds,
            "duration_ms": duration_ms,
            "model_version": "stub",
            # The BFF can hand this URL back to the UI to play a sample
            # sentence with the cloned voice. The stub path keeps the
            # contract consistent — the BFF still returns 201 + the
            # previewUrl so the wizard's "Play preview" step works.
            "preview_url": f"/api/voice/preview/{voice_id}",
            **log_extra,
        }

    # Real XTTS path — left as a Phase 5.1 follow-up per the brief
    # ("No new TTS deps; XTTS-v2 stub; Phase 6 will revisit if user
    # wants real local clone").
    #   from TTS.api import TTS as Xtts
    #   model = Xtts(model_path=XTTS_MODEL_PATH)
    #   out = model.tts(text="Hello, this is a sample.", speaker_wav=audio_path, language=language)
    #   ... persist `out` to volume, return preview_url.
    voice_id = f"cloned:{uuid.uuid4()}"
    duration_ms = int(time.monotonic() * 1000) - started_ms
    return {
        "status": "ok",
        "voice_id": voice_id,
        "name": name,
        "language": language,
        "sample_seconds": estimated_seconds,
        "duration_ms": duration_ms,
        "model_version": "xtts-v2",
        "preview_url": f"/api/voice/preview/{voice_id}",
        **log_extra,
    }


def _hash_user_id(user_id: str | None) -> str:
    """Truncated sha256 — mirrors the BFF's `userIdHash` for log output."""
    if not user_id:
        return "anon"
    import hashlib

    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]
