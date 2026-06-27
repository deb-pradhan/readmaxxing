"""FastAPI HTTP server for the ReadMaxxing worker.

Exposes:
  - GET /health                  liveness check
  - GET /ready                   readiness check (DB + Redis ping)
  - POST /v1/parse               sync doc parsing (URL / paste / file → text)
  - POST /v1/ocr                 vision-LLM OCR for image scans
  - POST /v1/ai/summary          sync AI summary (Phase 3)
  - POST /v1/ai/quiz             sync AI quiz
  - POST /v1/ai/recap            sync AI recap
  - POST /v1/ai/ask              sync AI ask
  - POST /v1/ai/fillers          sync AI filler detection
  - POST /v1/ai/run              generic chat-completion passthrough
  - POST /v1/podcast/run         sync podcast generation (Phase 4)
  - GET  /v1/podcast/{id}/progress  SSE stage stream (Phase 4)
  - GET  /v1/podcast/{id}/audio     stream mastered MP3 (Phase 4)
  - POST /v1/tts/stream          stream TTS synthesis (Phase 2)
  - POST /v1/tts/clone           voice-clone task (Phase 5)

The BFF (`apps/web/app/api/ai/*`) prefers these HTTP wrappers when
`WORKER_API_URL` is set, falling back to the in-process `@readmaxxing/ai`
client otherwise. Both paths share the same prompt helpers and OpenRouter
client, so the output is identical.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .celery_app import celery_app
from .config import get_settings
from .tasks import ai as ai_tasks
from .tasks import openrouter as or_client
from .tasks import podcast as podcast_tasks
from .tasks import tts as tts_tasks

logger = logging.getLogger("readmaxxing.worker")
logging.basicConfig(level=get_settings().log_level)

app = FastAPI(
    title="ReadMaxxing Worker",
    version="0.1.0",
    description="Document parsing, OCR, LLM orchestration, and local TTS.",
)


class HealthResponse(BaseModel):
    ok: bool
    service: str = "readmaxxing-worker"
    version: str = "0.1.0"


class ReadyResponse(BaseModel):
    ok: bool
    redis: bool
    celery: bool


class ParseRequest(BaseModel):
    document_id: str
    source: str
    source_type: str = Field(default="url")  # url | pdf | docx | md | epub | txt | paste
    text: str | None = None  # when source_type == "paste"


class AISummaryRequest(BaseModel):
    document_id: str
    text: str
    style: str = "default"


class AIQuizRequest(BaseModel):
    document_id: str
    text: str
    question_count: int = 5


class AIRecapRequest(BaseModel):
    document_id: str
    text: str
    last_paragraph_index: int
    last_sentence_index: int


class AIAskRequest(BaseModel):
    document_id: str
    text: str
    question: str


class AIFillersRequest(BaseModel):
    document_id: str
    text: str


class AIRunRequest(BaseModel):
    """Generic chat-completion passthrough.

    The BFF sends the same `messages` + optional `json_schema` that it would
    have used in-process. The worker returns the parsed text + the raw usage
    envelope so the BFF can persist + log without re-parsing.
    """

    feature: str = Field(pattern=r"^(summary|quiz|recap|ask|fillers)$")
    document_id: str | None = None
    messages: list[dict[str, str]]
    model: str | None = None
    json_schema: dict | None = None
    temperature: float | None = None
    max_tokens: int | None = None


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness — does not touch any external dependency."""
    return HealthResponse(ok=True)


@app.get("/ready", response_model=ReadyResponse)
async def ready() -> ReadyResponse:
    """Readiness — checks Redis + Celery connectivity."""
    redis_ok = True
    celery_ok = True
    try:
        celery_app.connection().ensure_connection(max_retries=1)
    except Exception as exc:
        logger.warning("celery ping failed: %s", exc)
        celery_ok = False
    try:
        import redis

        redis.Redis.from_url(get_settings().redis_url).ping()
    except Exception as exc:
        logger.warning("redis ping failed: %s", exc)
        redis_ok = False
    return ReadyResponse(
        ok=redis_ok and celery_ok,
        redis=redis_ok,
        celery=celery_ok,
    )


@app.post("/v1/parse")
async def parse(req: ParseRequest) -> dict[str, Any]:
    """Sync parsing — wired in Phase 2. Phase 1 returns a clear stub."""
    raise HTTPException(
        status_code=501,
        detail="parse() is wired in Phase 2 (Reader Core).",
    )


# =============================================================================
# Phase 5 — OCR scan-and-listen.
# =============================================================================


class OcrRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=200)
    image_base64: str = Field(min_length=1)
    language: str = Field(default="eng", max_length=8)


@app.post("/v1/ocr")
async def ocr(req: OcrRequest) -> dict[str, Any]:
    """Run vision-LLM OCR on a base64 image; return text + confidence."""
    from .tasks import ocr as ocr_tasks

    return ocr_tasks.ocr_image(
        image_base64=req.image_base64,
        document_id=req.document_id,
        language=req.language,
    )


# =============================================================================
# AI routes — thin HTTP wrappers around the existing Celery tasks.
# BFF calls these when WORKER_API_URL is set; otherwise it runs in-process.
# Both paths return the same shape.
# =============================================================================


def _msgs(req_messages: list[dict[str, str]]) -> list[or_client.ChatMessage]:
    return [or_client.ChatMessage(role=m["role"], content=m["content"]) for m in req_messages]


@app.post("/v1/ai/run")
async def ai_run(req: AIRunRequest) -> dict[str, Any]:
    """Generic chat-completion passthrough used by the BFF.

    Returns `{ text, parsed, model, usage }` so the BFF can persist, meter,
    and log without re-parsing the response.
    """
    messages = _msgs(req.messages)
    if not messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    text, usage = or_client.acomplete(
        messages,
        model=req.model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        json_schema=req.json_schema,
        feature=req.feature,
    )
    parsed = None
    if req.json_schema is not None:
        import json as _json

        try:
            parsed = _json.loads(text)
        except Exception:
            # strip code fence
            cleaned = text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            parsed = _json.loads(cleaned)
    return {
        "text": text,
        "parsed": parsed,
        "model": req.model or or_client._default_model(),
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
    }


@app.post("/v1/ai/summary")
async def ai_summary(req: AISummaryRequest) -> dict[str, Any]:
    return ai_tasks.generate_summary(req.text, req.document_id, style=req.style)


@app.post("/v1/ai/quiz")
async def ai_quiz(req: AIQuizRequest) -> dict[str, Any]:
    return ai_tasks.generate_quiz(req.text, req.document_id, question_count=req.question_count)


@app.post("/v1/ai/recap")
async def ai_recap(req: AIRecapRequest) -> dict[str, Any]:
    return ai_tasks.generate_recap(
        req.text,
        req.document_id,
        last_paragraph_index=req.last_paragraph_index,
        last_sentence_index=req.last_sentence_index,
    )


@app.post("/v1/ai/ask")
async def ai_ask(req: AIAskRequest) -> dict[str, Any]:
    return ai_tasks.ask_document(req.text, req.question, req.document_id)


@app.post("/v1/ai/fillers")
async def ai_fillers(req: AIFillersRequest) -> dict[str, Any]:
    return ai_tasks.detect_fillers(req.text, req.document_id)


# =============================================================================
# Phase 5 — Voice cloning (XTTS-v2 stub).
# =============================================================================


class TtsCloneRequest(BaseModel):
    audio_base64: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=80)
    user_id: str = Field(min_length=1, max_length=200)
    language: str = Field(default="en", max_length=8)


@app.post("/v1/tts/clone")
async def tts_clone(req: TtsCloneRequest) -> dict[str, Any]:
    """Run the voice-clone task. Returns the manifest the BFF persists."""
    return tts_tasks.clone_voice(
        audio_base64=req.audio_base64,
        name=req.name,
        user_id=req.user_id,
        language=req.language,
    )


# =============================================================================
# Phase 4 — Podcast pipeline.
#
# - POST /v1/podcast/run            sync orchestrator; returns the manifest.
# - GET  /v1/podcast/{id}/progress  SSE stream of `podcast.stage` events.
# - GET  /v1/podcast/{id}/audio     bytes-range stream of the mastered MP3.
# =============================================================================


class PodcastRunRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=200)
    document_text: str = Field(min_length=1)
    style: str = Field(default="podcast", pattern=r"^(podcast|late_night|debate|lecture)$")
    depth: str = Field(default="normal", pattern=r"^(brief|normal|deep)$")
    title: str | None = None
    host_voice_id: str = "eleven_rachel"
    guest_voice_id: str = "elevenlabs_josh"
    model: str | None = None
    request_id: str | None = None


@app.post("/v1/podcast/run")
async def podcast_run(req: PodcastRunRequest) -> dict[str, Any]:
    """Generate a podcast episode synchronously and return the manifest.

    The BFF (apps/web/app/api/ai/podcasts/route.ts) hits this endpoint and
    persists the returned `audio_path` / `speech_marks` into the
    `podcast_episodes` table. We do NOT touch Postgres here — the worker
    only writes the audio file to `PODCAST_VOLUME_PATH`.
    """
    import uuid as _uuid

    return podcast_tasks.generate_podcast(
        req.document_id,
        req.document_text,
        request_id=req.request_id or str(_uuid.uuid4()),
        style=req.style,
        depth=req.depth,
        title=req.title,
        host_voice_id=req.host_voice_id,
        guest_voice_id=req.guest_voice_id,
        model=req.model,
    )


@app.get("/v1/podcast/{episode_id}/progress")
async def podcast_progress(episode_id: str, request: Request) -> StreamingResponse:
    """SSE stream of `podcast.stage` events for a given episode.

    The first frame replays the full history so late subscribers see the
    timeline; subsequent frames are pushed in real time as the worker
    emits new stages. Honors `request.signal.aborted` for clean teardown.
    """
    encoder = StreamingResponse  # placeholder for type checkers
    del encoder  # noqa

    async def stream():
        # Replay history so a late subscriber still gets the full timeline.
        for evt in podcast_tasks.get_stage_history(episode_id):
            yield _format_sse(evt.stage, _stage_event_dict(evt))
        # Initial heartbeat so the connection is open before the next
        # event arrives.
        yield ": connected\n\n"
        last_seen = len(podcast_tasks.get_stage_history(episode_id))
        last_latest = podcast_tasks.get_latest_stage(episode_id)
        # Long-poll loop: emit any new stage events until the connection
        # closes OR the episode reaches `completed`/`failed` AND has been
        # at rest for ≥ 2s (so the client has time to receive the final
        # frame).
        idle_count = 0
        while True:
            if await request.is_disconnected():
                return
            await asyncio.sleep(0.5)
            history = podcast_tasks.get_stage_history(episode_id)
            latest = podcast_tasks.get_latest_stage(episode_id)
            if len(history) > last_seen:
                for evt in history[last_seen:]:
                    yield _format_sse(evt.stage, _stage_event_dict(evt))
                last_seen = len(history)
                idle_count = 0
            elif latest and (last_latest is None or latest.timestamp > last_latest.timestamp):
                yield _format_sse(latest.stage, _stage_event_dict(latest))
                last_latest = latest
                idle_count = 0
            else:
                idle_count += 1
            # Stop after we've sent the terminal stage AND nothing has
            # changed for ≥ 2s.
            if latest and latest.stage in ("completed", "failed") and idle_count >= 4:
                return
            # Heartbeat every 5s to keep the connection alive through proxies.
            if idle_count % 10 == 0 and idle_count > 0:
                yield ": keep-alive\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/v1/podcast/{episode_id}/audio")
async def podcast_audio(episode_id: str, request: Request):
    """Stream the mastered MP3 for an episode with Range-request support.

    The BFF calls this with `Range: bytes=…` so the player's `<audio>` tag
    can seek without downloading the whole file. We resolve the episode by
    scanning the volume root for `<document_id>/<episode_id>.mp3`.
    """
    volume_root = Path(os.getenv("PODCAST_VOLUME_PATH", "/data/podcasts"))
    matches = list(volume_root.rglob(f"{episode_id}.mp3"))
    if not matches:
        raise HTTPException(status_code=404, detail="episode_not_found")
    # First match wins — episode ids are uuids so collisions are implausible.
    audio_file = matches[0]
    if not audio_file.exists():
        raise HTTPException(status_code=404, detail="episode_not_found")
    file_size = audio_file.stat().st_size
    range_header = request.headers.get("range") or request.headers.get("Range")
    if range_header:
        try:
            start_str, end_str = range_header.replace("bytes=", "").split("-", 1)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1
        except Exception:
            raise HTTPException(status_code=416, detail="invalid_range")

        def iterfile():
            with audio_file.open("rb") as fh:
                fh.seek(start)
                remaining = length
                chunk = 64 * 1024
                while remaining > 0:
                    data = fh.read(min(chunk, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iterfile(),
            status_code=206,
            media_type="audio/mpeg",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Cache-Control": "private, max-age=86400",
            },
        )
    # No Range header — full file.
    def iterfile_full():
        with audio_file.open("rb") as fh:
            while True:
                data = fh.read(64 * 1024)
                if not data:
                    break
                yield data

    return StreamingResponse(
        iterfile_full(),
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "private, max-age=86400",
        },
    )


def _stage_event_dict(evt: podcast_tasks.StageEvent) -> dict[str, Any]:
    return {
        "stage": evt.stage,
        "duration_ms": evt.duration_ms,
        "progress_pct": evt.progress_pct,
        "status": evt.status,
        "episode_id": evt.episode_id,
        "request_id": evt.request_id,
        "timestamp": evt.timestamp,
    }


def _format_sse(stage: str, payload: dict[str, Any]) -> str:
    return f"event: {stage}\ndata: {json.dumps(payload)}\n\n"


def run() -> None:  # pragma: no cover — entrypoint shim for pyproject script
    """Console-script entry: `readmaxxing-worker`."""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=get_settings().port,
        reload=get_settings().env == "development",
    )


if __name__ == "__main__":  # pragma: no cover
    run()