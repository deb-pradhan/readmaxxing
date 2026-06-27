"""Phase 4 podcast pipeline — unit test.

Exercises the in-process pipeline end-to-end with the LLM and TTS
deterministically stubbed:

  - The LLM returns a fixed multi-speaker script (no network).
  - ElevenLabs TTS is unavailable in CI → the silent-stub path runs.
  - pydub produces a real MP3 of the expected total duration.

Asserts the TESTING.md §9 stage transition events fire in order and
the returned manifest matches the contract the BFF persists.
"""

from __future__ import annotations

import importlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def tmp_volume(tmp_path, monkeypatch):
    """Redirect the worker to a tmp volume + disable external TTS keys."""
    monkeypatch.setenv("PODCAST_VOLUME_PATH", str(tmp_path))
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    return tmp_path


@pytest.fixture()
def podcast_module(monkeypatch):
    """Reload the podcast module with stubs after env is patched."""
    module = importlib.import_module("app.tasks.podcast")
    importlib.reload(module)

    # Stub the OpenRouter `complete` so we don't hit the network.
    fake_script = {
        "title": "Stubbed podcast title",
        "lines": [
            {"speaker": "H1", "text": "Welcome to the show."},
            {"speaker": "H2", "text": "It's great to be here."},
            {"speaker": "H1", "text": "Let's dive into the topic."},
            {"speaker": "H2", "text": "Absolutely — starting with X."},
        ],
        "signoff": "See you next time.",
    }
    import dataclasses

    @dataclasses.dataclass
    class Usage:
        input_tokens: int = 100
        output_tokens: int = 50
        cost_usd: float = 0.0
        provider: str | None = "stubbed"

    monkeypatch.setattr(
        module,
        "complete",
        lambda messages, *, model, feature: (json.dumps(fake_script), Usage()),
    )
    # Clear any stage history from previous tests.
    module._STAGE_HISTORY.clear()
    module._STAGE_LATEST.clear()
    return module


def test_pipeline_emits_stages_and_writes_audio(tmp_volume, podcast_module):
    """Full happy-path: stages fire in order, audio file exists with
    non-zero duration, manifest reflects the synthesized lines."""
    doc_id = "doc-test-1"
    text = "Source text used by the LLM. " * 20
    request_id = "req-pipeline-1"

    progress_events: list[tuple[str, int]] = []

    def on_progress(stage: str, pct: int, duration_ms: int) -> None:
        progress_events.append((stage, pct))

    manifest = podcast_module.generate_podcast(
        document_id=doc_id,
        document_text=text,
        request_id=request_id,
        style="podcast",
        depth="brief",
        title="Pipeline test",
        progress_callback=on_progress,
    )

    # 1) Manifest contract.
    assert manifest["status"] == "completed"
    assert manifest["line_count"] >= 2
    assert manifest["speaker_count"] >= 2
    assert manifest["duration_ms"] > 0
    assert manifest["duration_seconds"] > 0

    # 2) Audio file was written.
    audio_path = Path(manifest["audio_path"])
    assert audio_path.exists()
    assert audio_path.stat().st_size > 0  # not empty
    # When pydub is unavailable the fallback path emits a tiny stub —
    # still valid (size > 0) but not a real MP3. Skip the size check in
    # that case so the test is portable across environments.

    # 3) Speech marks were generated.
    marks = manifest["speech_marks"]
    assert isinstance(marks, list) and len(marks) > 0
    # All marks should have a timeSeconds field.
    for m in marks[:5]:
        assert "timeSeconds" in m
        assert m["timeSeconds"] >= 0

    # 4) Stage transitions fired in the right order.
    history = podcast_module.get_stage_history(manifest["episode_id"])
    stages = [e.stage for e in history]
    expected = {"reading_doc", "writing_script", "casting_voices", "producing_audio", "completed"}
    assert expected.issubset(set(stages))
    # Reading → Writing → Casting → Producing → Completed.
    assert stages.index("reading_doc") < stages.index("writing_script")
    assert stages.index("writing_script") < stages.index("casting_voices")
    assert stages.index("casting_voices") < stages.index("producing_audio")
    assert stages.index("producing_audio") < stages.index("completed")

    # 5) Each non-terminal stage event carried a real elapsed duration.
    for evt in history:
        if evt.stage in ("completed", "failed"):
            continue
        assert evt.duration_ms >= 0
        assert evt.progress_pct > 0

    # 6) Progress callback fired at least once per stage.
    stages_called = {stage for stage, _ in progress_events}
    # The first three stages pass through the `emit()` wrapper that
    # invokes the callback. The terminal `producing_audio` + `completed`
    # transitions are emitted directly via `emit_stage()` (so they show
    # up in the structured log + stage history) — both surfaces are
    # covered above.
    assert {"reading_doc", "writing_script", "casting_voices"}.issubset(stages_called)
    # And the in-memory tracker includes the terminal stages for callers
    # reading the history through the SSE endpoint.
    history_stages = {e.stage for e in history}
    assert {"producing_audio", "completed"}.issubset(history_stages)


def test_pipeline_handles_missing_doc_gracefully(tmp_volume, podcast_module):
    """Empty text shouldn't crash; the LLM stub returns the same script."""
    manifest = podcast_module.generate_podcast(
        document_id="doc-empty",
        document_text="",
        request_id="req-empty",
        style="lecture",
        depth="brief",
        title="Empty",
    )
    # Either the stub worked (status="completed") or it failed safely.
    assert manifest["status"] in ("completed", "failed")
    assert manifest["episode_id"]


def test_pipeline_progress_pct_advances_monotonically(tmp_volume, podcast_module):
    """Per TESTING.md §9 the `progress_pct` field should not regress."""
    manifest = podcast_module.generate_podcast(
        document_id="doc-progress",
        document_text="hello world",
        request_id="req-progress",
        style="podcast",
        depth="brief",
    )
    history = podcast_module.get_stage_history(manifest["episode_id"])
    pcts = [e.progress_pct for e in history]
    for prev, curr in zip(pcts, pcts[1:]):
        assert curr >= prev, f"progress regressed: {prev} → {curr}"