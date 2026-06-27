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
        "app.tasks.leaderboard_cron",
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
        "app.tasks.leaderboard_cron.*": {"queue": "leaderboard"},
    },
    # Celery Beat schedule — runs the weekly promotion every Monday at
    # 00:00 UTC. The BFF's leaderboard route reads the
    # `LeaderboardEntry` table that this task populates.
    beat_schedule={
        "leaderboard.weekly_promotion": {
            "task": "app.tasks.leaderboard_cron.run_weekly_promotion",
            "schedule": 7 * 24 * 60 * 60.0,  # 7 days in seconds (crontab is
            # configured in the Railway service; Beat uses this as a
            # default schedule).
            "options": {"queue": "leaderboard"},
        },
    },
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

__all__ = ["celery_app"]