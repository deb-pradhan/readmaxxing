"""AI Podcast generation — multi-speaker script → TTS → master → volume.

Phase 4 wires the full pipeline. The Phase 1 scaffold implements the
script-writing stage (OpenRouter) and persists a clear interface for the
TTS + mastering stages so they can be filled in without touching this
module.

The podcast audio is the one exception to the "no server audio storage"
rule (per the v1 plan, blobs hybrid option B): episodes are expensive to
regenerate and meant to be re-listenable, so they're persisted to the
Railway volume mounted at `PODCAST_VOLUME_PATH` and streamed via the BFF.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path

from celery import shared_task

from .openrouter import complete, podcast_script_messages

logger = logging.getLogger("readmaxxing.podcast")

DEFAULT_PODCAST_MODEL = os.getenv("OPENROUTER_PODCAST_MODEL", "openai/gpt-4o-mini")


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


@shared_task(name="app.tasks.podcast.generate_podcast", queue="podcast")
def generate_podcast(
    document_id: str,
    document_text: str,
    *,
    style: str = "podcast",
    depth: str = "normal",
    host_voice_id: str = "elevenlabs_rachel",
    guest_voice_id: str = "elevenlabs_josh",
    model: str | None = None,
) -> dict:
    """Orchestrate script → TTS → master → persist to volume.

    Returns a dict describing the episode (`script`, `audio_path`,
    `duration_seconds`, `status`, `usage`). The TTS + master steps are
    stubbed in Phase 1 and real in Phase 4.
    """
    logger.info(
        "generate_podcast: document_id=%s style=%s depth=%s",
        document_id,
        style,
        depth,
    )

    # 1) Script -----------------------------------------------------------------
    messages = podcast_script_messages(document_text, style=style, depth=depth)
    script_text, usage = complete(
        messages, model=model or DEFAULT_PODCAST_MODEL, feature="podcast_script"
    )
    script = _script_to_json(script_text)

    # 2) TTS per line -----------------------------------------------------------
    # Phase 4 hooks `app.tasks.tts.synthesize_line` here. For now we record the
    # intent and the script so the BFF can show honest staged progress.
    lines = script.get("lines", [])
    logger.info("generate_podcast: %d lines to synthesize", len(lines))

    # 3) Master + persist -------------------------------------------------------
    volume_root = Path(os.getenv("PODCAST_VOLUME_PATH", "/data/podcasts"))
    episode_dir = volume_root / document_id
    episode_dir.mkdir(parents=True, exist_ok=True)
    episode_id = str(uuid.uuid4())
    audio_path = episode_dir / f"{episode_id}.json"  # manifest until Phase 4
    audio_path.write_text(
        json.dumps(
            {
                "episode_id": episode_id,
                "document_id": document_id,
                "style": style,
                "depth": depth,
                "host_voice_id": host_voice_id,
                "guest_voice_id": guest_voice_id,
                "lines": lines,
                "signoff": script.get("signoff", ""),
                "title": script.get("title", "Untitled"),
                "status": "scripted",  # → "mastered" in Phase 4
            },
            indent=2,
        )
    )

    return {
        "episode_id": episode_id,
        "document_id": document_id,
        "title": script.get("title", "Untitled"),
        "audio_path": str(audio_path),
        "duration_seconds": 0.0,  # set by master step in Phase 4
        "status": "scripted",
        "lines": len(lines),
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "model": model or DEFAULT_PODCAST_MODEL,
    }