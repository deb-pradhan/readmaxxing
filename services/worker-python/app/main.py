"""FastAPI HTTP server for the ReadMaxxing worker.

Exposes:
  - GET /health                  liveness check
  - GET /ready                   readiness check (DB + Redis ping)
  - POST /v1/parse               sync doc parsing (URL / paste / file → text)
  - POST /v1/ocr                 sync OCR for image/PDF scans
  - POST /v1/ai/summary          sync AI summary (Phase 3)
  - POST /v1/tts/stream          stream TTS synthesis (Phase 2)

Phase 1 only requires /health to be live so Railway can deploy the worker
without the rest of the surface area.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .celery_app import celery_app
from .config import get_settings

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