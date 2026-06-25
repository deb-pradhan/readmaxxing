"""Local TTS — sherpa-onnx (Piper / Kokoro) stub.

Phase 5 wires the real local synthesis path:

  1. Download / mount a Piper (or Kokoro) onnx model.
  2. Instantiate `sherpa_onnx.OfflineTts` once per worker process.
  3. Call `synthesize(text, voice_id)` → bytes (WAV) + sample_rate.
  4. Stream to the BFF as the engine produces samples (chunked transfer).

For Phase 1 the task returns a clear "not configured" payload so the worker
boots and the BFF can already wire the queue.
"""

from __future__ import annotations

import logging
import os

from celery import shared_task

logger = logging.getLogger("readmaxxing.tts")

# Pre-baked defaults — adjust once we ship a real model.
PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "")
SHERPA_ONNX_LIB_PATH = os.getenv("SHERPA_ONNX_LIB_PATH", "")


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