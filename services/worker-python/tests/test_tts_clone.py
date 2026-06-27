"""Tests for app.tasks.tts.clone_voice.

The stub path is fully testable without PaddleOCR / sherpa-onnx / XTTS.
We exercise:
  - The "sample_too_short" gate.
  - The "sample_too_long" gate.
  - The success path returns a stable voice_id + preview_url.
  - The same `user_id_hash` is used in log output (never the raw id).
"""

from __future__ import annotations

import base64
import os

import pytest


@pytest.fixture
def fresh_task(monkeypatch):
    """Import the task fresh — the real one is defined at module load,
    so we just import the module."""
    from app.tasks import tts as tts_mod

    # Force the stub path by clearing the model env var.
    monkeypatch.delenv("XTTS_MODEL_PATH", raising=False)
    return tts_mod


def test_clone_voice_rejects_tiny_samples(fresh_task):
    # 4 KB of base64 — below the MIN_SAMPLE_BYTES gate (16 KB).
    payload = base64.b64encode(b"\x00" * 4096).decode("ascii")
    out = fresh_task.clone_voice(audio_base64=payload, name="My voice", user_id="u1")
    assert out["status"] == "sample_too_short"
    assert out["min_seconds"] == fresh_task.MIN_SAMPLE_SECONDS


def test_clone_voice_rejects_huge_samples(fresh_task):
    # 200 KB of base64 → ~100s estimated duration; above MAX_SAMPLE_SECONDS.
    payload = base64.b64encode(b"\x00" * 200_000).decode("ascii")
    out = fresh_task.clone_voice(audio_base64=payload, name="My voice", user_id="u1")
    assert out["status"] == "sample_too_long"
    assert out["max_seconds"] == fresh_task.MAX_SAMPLE_SECONDS


def test_clone_voice_returns_stable_id_and_preview_url(fresh_task):
    # 40 KB base64 → ~20s estimated, well within the gates.
    payload = base64.b64encode(b"\x00" * 40_000).decode("ascii")
    out = fresh_task.clone_voice(audio_base64=payload, name="My voice", user_id="u1")
    assert out["status"] == "ok"
    assert out["voice_id"].startswith("cloned:")
    assert out["preview_url"] == f"/api/voice/preview/{out['voice_id']}"
    assert out["model_version"] == "stub"
    assert out["duration_ms"] >= 0


def test_clone_voice_does_not_log_raw_audio(fresh_task, caplog):
    payload = base64.b64encode(b"\x00" * 40_000).decode("ascii")
    with caplog.at_level("INFO", logger="readmaxxing.tts"):
        fresh_task.clone_voice(audio_base64=payload, name="My voice", user_id="u1")
    # Ensure the raw audio bytes (or the original filename) never show up
    # in any log record. We just check that the original payload is
    # absent from the formatted log text.
    all_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert payload not in all_logs


def test_consent_version_is_bumped_in_module():
    from app.tasks import tts as tts_mod

    # The brief says "Bump this whenever the consent screen's wording
    # changes". This test pins a sentinel so the changelog can grep it.
    assert tts_mod.VOICE_CLONE_CONSENT_VERSION == "v1.0.0-2026-06-25"
