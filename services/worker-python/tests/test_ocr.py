"""Tests for the vision-LLM OCR task.

OCR is performed by a vision-capable model through the OpenRouter gateway
(see `app.tasks.openrouter.complete_vision`). The network call is mocked;
we exercise the pure mapping logic: data-URL construction, JSON parsing,
and the confidence / low_confidence / illegible contract the BFF expects.
"""

from __future__ import annotations

import base64
import json

import pytest

# Minimal valid magic-byte prefixes so mime detection has something to read.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 32
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"0" * 32


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _vision_returning(payload: dict):
    """Build a fake `complete_vision` that records its call and returns JSON."""
    calls: list[dict] = []

    def fake(prompt: str, image_data_url: str, **kwargs):
        calls.append({"prompt": prompt, "image_data_url": image_data_url, **kwargs})
        return json.dumps(payload), None

    fake.calls = calls  # type: ignore[attr-defined]
    return fake


@pytest.fixture
def ocr_mod():
    from app.tasks import ocr as ocr_module

    return ocr_module


def test_transcribes_verbatim_and_maps_confidence(ocr_mod, monkeypatch):
    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "Hello world.", "confidence": 0.95, "has_illegible": False}),
    )
    out = ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-1")
    assert out["text"] == "Hello world."
    assert out["page_count"] == 1
    assert out["median_confidence"] == 0.95
    assert out["confidence_per_page"] == [0.95]
    assert out["low_confidence"] is False
    assert out["engine"].startswith("vision:")


def test_low_confidence_when_below_threshold(ocr_mod, monkeypatch):
    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "blurry", "confidence": 0.5, "has_illegible": False}),
    )
    out = ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-2")
    assert out["low_confidence"] is True


def test_low_confidence_when_illegible_flagged(ocr_mod, monkeypatch):
    # High self-reported confidence, but the model flagged an illegible region.
    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "Mostly fine [illegible]", "confidence": 0.92, "has_illegible": True}),
    )
    out = ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-3")
    assert out["low_confidence"] is True


def test_clamps_out_of_range_confidence(ocr_mod, monkeypatch):
    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "x", "confidence": 1.7, "has_illegible": False}),
    )
    out = ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-4")
    assert out["confidence_per_page"] == [1.0]


def test_empty_text_passthrough(ocr_mod, monkeypatch):
    # The BFF turns empty text into a friendly "try a sharper photo" — the
    # worker just passes the empty string through.
    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "", "confidence": 0.2, "has_illegible": True}),
    )
    out = ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-5")
    assert out["text"] == ""
    assert out["low_confidence"] is True


def test_builds_data_url_with_detected_mime_and_feature(ocr_mod, monkeypatch):
    fake = _vision_returning({"text": "hi", "confidence": 0.9, "has_illegible": False})
    monkeypatch.setattr(ocr_mod, "complete_vision", fake)
    ocr_mod.ocr_image(_b64(JPEG_BYTES), "doc-6")
    call = fake.calls[0]  # type: ignore[attr-defined]
    assert call["image_data_url"].startswith("data:image/jpeg;base64,")
    assert call["feature"] == "ocr"
    assert call["json_schema"] is not None


def test_logs_low_confidence_warning(ocr_mod, monkeypatch, caplog):
    import logging

    monkeypatch.setattr(
        ocr_mod,
        "complete_vision",
        _vision_returning({"text": "blurry", "confidence": 0.3, "has_illegible": False}),
    )
    with caplog.at_level(logging.WARNING, logger="readmaxxing.ocr"):
        ocr_mod.ocr_image(_b64(PNG_BYTES), "doc-warn")
    all_text = "\n".join(record.getMessage() for record in caplog.records)
    assert "ocr.low_confidence" in all_text
