"""OCR tasks — extract text from scanned images via a vision LLM.

OCR is performed by a vision-capable model through the OpenRouter gateway
(`app.tasks.openrouter.complete_vision`) — the same single LLM gateway the
rest of the worker uses. There is no local OCR engine (Tesseract / PaddleOCR
were removed): a vision model gives better quality on photographed and
multi-column pages with zero native dependencies.

To keep the "trust > fluency" contract (UI-UX.md §7) the model is told to
transcribe verbatim, never summarize/translate, and mark unreadable text as
`[illegible]`. It self-reports a confidence (0–1) and whether any region was
illegible; we map those onto the existing low-confidence contract so the BFF
and reader behave exactly as before.

Contract (unchanged for the BFF):
  ocr_image(image_base64, document_id, language="eng")
  → {
      document_id: str,
      text: str,
      engine: str,                # "vision:<model>"
      language: str,
      page_count: int,            # always 1 for a single image
      median_confidence: float,   # 0.0–1.0
      low_confidence: bool,       # True if confidence < 0.7 OR illegible
      confidence_per_page: [float, ...],
      duration_ms: int,
    }
"""

from __future__ import annotations

import base64
import json
import logging
import time

from celery import shared_task

from .openrouter import complete_vision

logger = logging.getLogger("readmaxxing.ocr")

# Thresholds (TESTING.md §9 — log when confidence is low on a page).
LOW_CONFIDENCE_THRESHOLD = 0.7  # flagged in the response
WARN_CONFIDENCE_THRESHOLD = 0.6  # logged as a warning

OCR_SCHEMA = {
    "name": "ocr_result",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "text": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "has_illegible": {"type": "boolean"},
        },
        "required": ["text", "confidence", "has_illegible"],
    },
}

OCR_PROMPT = (
    "You are an OCR engine. Transcribe ALL text visible in this image exactly "
    "as written, preserving reading order and paragraph breaks. Do NOT "
    "summarize, translate, paraphrase, or add commentary. If a word or region "
    "is unreadable, write [illegible] in its place rather than guessing. "
    "Return your transcription, a confidence score from 0 to 1 reflecting how "
    "accurate and complete the transcription is, and whether any region was "
    "illegible."
)


def _detect_mime(image_bytes: bytes) -> str:
    """Sniff the image mime type from magic bytes; default to image/png."""
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    if image_bytes.startswith(b"GIF8"):
        return "image/gif"
    if image_bytes.startswith((b"II*\x00", b"MM\x00*")):
        return "image/tiff"
    return "image/png"


# =============================================================================
# Celery task
# =============================================================================


@shared_task(name="app.tasks.ocr.ocr_image", queue="ocr")
def ocr_image(
    image_base64: str,
    document_id: str,
    *,
    language: str = "eng",
) -> dict:
    """Run vision-LLM OCR over a base64-encoded image.

    Returns text + a single-page confidence mapped onto the existing OCR
    contract. Per TESTING.md §9 we emit `ocr.page_complete` and a warning
    when confidence is low.
    """
    started = time.monotonic()
    image_bytes = base64.b64decode(image_base64)
    mime = _detect_mime(image_bytes)
    logger.info(
        "ocr_image: document_id=%s mime=%s bytes=%d",
        document_id,
        mime,
        len(image_bytes),
    )

    data_url = f"data:{mime};base64,{image_base64}"
    content, _usage = complete_vision(
        OCR_PROMPT,
        data_url,
        json_schema=OCR_SCHEMA,
        temperature=0.0,
        feature="ocr",
    )

    try:
        parsed = json.loads(content)
        text = str(parsed.get("text", ""))
        confidence = float(parsed.get("confidence", 0.0))
        has_illegible = bool(parsed.get("has_illegible", False))
    except (ValueError, TypeError):
        # Defensive: a non-JSON reply still yields usable text at zero confidence.
        text = content
        confidence = 0.0
        has_illegible = True

    confidence = max(0.0, min(1.0, confidence))
    low = confidence < LOW_CONFIDENCE_THRESHOLD or has_illegible
    duration_ms = int((time.monotonic() - started) * 1000)

    logger.info(
        json_line(
            "ocr.page_complete",
            request_id="-",
            document_id=document_id,
            page_index=0,
            engine="vision",
            confidence=round(confidence, 3),
            has_illegible=has_illegible,
            duration_ms=duration_ms,
        )
    )
    if confidence < WARN_CONFIDENCE_THRESHOLD or has_illegible:
        logger.warning(
            json_line(
                "ocr.low_confidence",
                request_id="-",
                document_id=document_id,
                page_index=0,
                confidence=round(confidence, 3),
                has_illegible=has_illegible,
            )
        )

    return {
        "document_id": document_id,
        "text": text,
        "engine": f"vision:{_model_label()}",
        "language": language,
        "page_count": 1,
        "median_confidence": round(confidence, 3),
        "low_confidence": low,
        "confidence_per_page": [round(confidence, 3)],
        "duration_ms": duration_ms,
    }


def _model_label() -> str:
    """Best-effort model name for the `engine` field (telemetry only)."""
    try:
        from .openrouter import _default_model

        return _default_model()
    except Exception:
        return "openrouter"


def json_line(event: str, **fields: object) -> str:
    """Minimal JSON-line helper for structured logs (avoids extra deps)."""
    return json.dumps({"event": event, **fields})
