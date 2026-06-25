"""Celery tasks for the ReadMaxxing worker.

Task modules in this package (each has its own `app.tasks.<name>` namespace
and Celery queue):

  - `parse`     — Document parsing → SegmentTree (mirrors packages/core/src/pipeline/segment-tree.ts)
  - `ocr`       — OCR for scans (PaddleOCR / Tesseract)
  - `ai`        — OpenRouter-backed AI tasks (summary, quiz, recap, ask, fillers)
  - `podcast`   — Multi-speaker podcast generation
  - `tts`       — Local TTS stub (Phase 5)

The Celery app includes every module here so worker processes boot them on
startup; see `app.celery_app:celery_app`.
"""

from __future__ import annotations

# Task modules self-register on import — Celery picks them up via the
# `include=[...]` list in `app.celery_app`.
__all__: list[str] = []