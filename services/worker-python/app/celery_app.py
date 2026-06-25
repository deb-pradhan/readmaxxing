"""Celery application for the ReadMaxxing worker.

Used for async jobs: document parsing, OCR, embeddings, AI summary / quiz /
podcast script generation, local TTS synthesis. The Celery worker is
deployed as a separate Railway process so the FastAPI HTTP server stays
responsive.
"""

from __future__ import annotations

from celery import Celery

from .config import get_settings

_settings = get_settings()

celery_app = Celery(
    "readmaxxing",
    broker=_settings.redis_url,
    backend=_settings.redis_url,
    include=[
        "app.tasks.openrouter",
        "app.tasks.parse",
        "app.tasks.ocr",
        "app.tasks.ai",
        "app.tasks.podcast",
        "app.tasks.tts",
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    task_default_queue="default",
    task_routes={
        "app.tasks.parse.*": {"queue": "parse"},
        "app.tasks.ocr.*": {"queue": "ocr"},
        "app.tasks.ai.*": {"queue": "ai"},
        "app.tasks.podcast.*": {"queue": "podcast"},
        "app.tasks.tts.*": {"queue": "tts"},
    },
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

__all__ = ["celery_app"]