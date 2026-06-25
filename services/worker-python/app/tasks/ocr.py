"""OCR tasks — extract text from scanned images and PDFs.

Phase 5 (Voice Typing, Voice Cloning, OCR) wires PaddleOCR as the primary
engine with Tesseract as a fast fallback. The Phase 1 scaffold keeps both
adapters behind a thin interface so the calling code (Celery task + FastAPI
endpoint) doesn't need to know which engine produced the text.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Protocol

from celery import shared_task

logger = logging.getLogger("readmaxxing.ocr")


class OcrEngine(Protocol):
    """Minimal OCR-engine contract."""

    def image_to_text(self, image_bytes: bytes, *, language: str = "eng") -> str:
        ...


class TesseractEngine:
    """Tesseract via `pytesseract`. Lightweight, CPU-only."""

    def __init__(self) -> None:
        import pytesseract  # local import — heavy at import-time
        from PIL import Image  # noqa: F401  (Pillow image handling)

        self._pytesseract = pytesseract

    def image_to_text(self, image_bytes: bytes, *, language: str = "eng") -> str:
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes))
        return self._pytesseract.image_to_string(image, lang=language)


class PaddleOcrEngine:
    """PaddleOCR (PaddlePaddle backend). Higher accuracy for noisy scans."""

    def __init__(self) -> None:
        from paddleocr import PaddleOCR  # type: ignore[import-not-found]

        self._engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

    def image_to_text(self, image_bytes: bytes, *, language: str = "eng") -> str:
        import numpy as np
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(image)
        result = self._engine.ocr(arr, cls=True)
        # `result` is a list of pages, each a list of (bbox, (text, score)).
        lines: list[str] = []
        for page in result:
            for _bbox, (text, _score) in page or []:
                if text:
                    lines.append(text)
        return "\n".join(lines)


def _build_engine(prefer: str = "tesseract") -> OcrEngine:
    """Pick an engine lazily so the worker can boot even if a backend fails."""
    if prefer == "paddle":
        try:
            return PaddleOcrEngine()
        except Exception as exc:  # pragma: no cover — runtime fallback
            logger.warning("PaddleOCR unavailable, falling back to Tesseract: %s", exc)
    return TesseractEngine()


# =============================================================================
# Celery task
# =============================================================================


@shared_task(name="app.tasks.ocr.ocr_image", queue="ocr")
def ocr_image(
    image_base64: str,
    document_id: str,
    *,
    language: str = "eng",
    engine: str = "tesseract",
) -> dict:
    """Run OCR over a base64-encoded image.

    The worker pipeline for "Scan & Listen" (UI-UX.md §5):
      client → BFF → enqueue `ocr_image` → parse_document on the extracted
      text → same segment-tree flow as paste/file imports.

    Returns a dict with `text`, `engine`, and `language` for downstream
    attribution.
    """
    image_bytes = base64.b64decode(image_base64)
    logger.info(
        "ocr_image: document_id=%s engine=%s bytes=%d", document_id, engine, len(image_bytes)
    )
    ocr_engine = _build_engine(engine)
    text = ocr_engine.image_to_text(image_bytes, language=language)
    return {
        "document_id": document_id,
        "text": text,
        "engine": engine,
        "language": language,
    }