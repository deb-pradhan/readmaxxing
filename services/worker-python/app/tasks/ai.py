"""AI tasks — summary, quiz, recap, ask-the-doc, filler detection.

All tasks call OpenRouter via `app.tasks.openrouter` (a single HTTP client)
rather than the OpenAI or Anthropic SDKs. This means one API key in
`OPENROUTER_API_KEY` gives us access to any model — `openai/gpt-4o-mini`,
`anthropic/claude-3-5-sonnet`, `google/gemini-2.5-pro`, etc. — and automatic
fallback. Override the per-task model via the `model` argument or the
`OPENROUTER_DEFAULT_MODEL` env var.

Per docs/UI-UX.md §7 ("AI features are servants, not stars"):
  - Every summary/quiz/recap/answer is source-cited using `[cite:p:s]` tags.
  - The system prompt forbids inventing facts.
  - The worker returns both the parsed output and the raw text so the BFF
    can choose what to persist.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from celery import shared_task

from .openrouter import (
    ask_messages,
    complete,
    filler_messages,
    quiz_messages,
    recap_messages,
    summary_messages,
)

logger = logging.getLogger("readmaxxing.ai")

# Default models — override per-task by passing `model=...`.
DEFAULT_SUMMARY_MODEL = "openai/gpt-4o-mini"
DEFAULT_QUIZ_MODEL = "openai/gpt-4o-mini"
DEFAULT_RECAP_MODEL = "openai/gpt-4o-mini"
DEFAULT_ASK_MODEL = "openai/gpt-4o-mini"
DEFAULT_FILLER_MODEL = "openai/gpt-4o-mini"


def _strip_code_fence(text: str) -> str:
    """Some providers return JSON wrapped in ```…```. Strip before parsing."""
    t = text.strip()
    if t.startswith("```"):
        first_newline = t.find("\n")
        if first_newline != -1:
            t = t[first_newline + 1 :]
        if t.endswith("```"):
            t = t[: -len("```")]
    return t.strip()


def _parse_json_safely(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_strip_code_fence(text))


# =============================================================================
# Summary — layered (TL;DR → bullets → detailed)
# =============================================================================


@shared_task(name="app.tasks.ai.generate_summary", queue="ai")
def generate_summary(
    document_text: str,
    document_id: str,
    *,
    style: str = "default",
    model: str | None = None,
) -> dict:
    """Generate a layered summary (TL;DR / bullets / detailed).

    The BFF persists the result into the `Summary.layers` JSONB column. Source
    citations are returned separately so they can also be stored / re-rendered.
    """
    messages = summary_messages(document_text, style=style)
    text, usage = complete(
        messages, model=model or DEFAULT_SUMMARY_MODEL, feature="summary"
    )
    logger.info(
        "generate_summary: document_id=%s in=%d out=%d cost=%.6f",
        document_id,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_usd,
    )
    return {
        "document_id": document_id,
        "text": text,
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "style": style,
        "model": model or DEFAULT_SUMMARY_MODEL,
    }


# =============================================================================
# Quiz — retrieval-practice
# =============================================================================


@shared_task(name="app.tasks.ai.generate_quiz", queue="ai")
def generate_quiz(
    document_text: str,
    document_id: str,
    *,
    question_count: int = 5,
    model: str | None = None,
) -> dict:
    """Generate a retrieval-practice quiz with multiple-choice questions."""
    messages, schema = quiz_messages(document_text, question_count=question_count)
    text, usage = complete(
        messages,
        model=model or DEFAULT_QUIZ_MODEL,
        feature="quiz",
        json_schema=schema,
    )
    logger.info(
        "generate_quiz: document_id=%s questions=%d in=%d out=%d cost=%.6f",
        document_id,
        question_count,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_usd,
    )
    parsed = _parse_json_safely(text)
    return {
        "document_id": document_id,
        "questions": parsed.get("questions", []),
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "model": model or DEFAULT_QUIZ_MODEL,
    }


# =============================================================================
# Recap — Zeigarnik-effect "pick up where you left off"
# =============================================================================


@shared_task(name="app.tasks.ai.generate_recap", queue="ai")
def generate_recap(
    document_text: str,
    document_id: str,
    *,
    last_paragraph_index: int,
    last_sentence_index: int,
    model: str | None = None,
) -> dict:
    """Short, specific recap the user sees on return."""
    messages = recap_messages(
        document_text,
        last_paragraph_index=last_paragraph_index,
        last_sentence_index=last_sentence_index,
    )
    text, usage = complete(
        messages, model=model or DEFAULT_RECAP_MODEL, feature="recap"
    )
    logger.info(
        "generate_recap: document_id=%s anchor=(%d,%d) in=%d out=%d",
        document_id,
        last_paragraph_index,
        last_sentence_index,
        usage.input_tokens,
        usage.output_tokens,
    )
    return {
        "document_id": document_id,
        "anchor": {
            "paragraphIndex": last_paragraph_index,
            "sentenceIndex": last_sentence_index,
        },
        "text": text,
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "model": model or DEFAULT_RECAP_MODEL,
    }


# =============================================================================
# Ask-the-doc — grounded Q&A
# =============================================================================


@shared_task(name="app.tasks.ai.ask_document", queue="ai")
def ask_document(
    document_text: str,
    question: str,
    document_id: str,
    *,
    model: str | None = None,
) -> dict:
    """Answer a single question about the document. Returns a citation-rich response."""
    messages = ask_messages(document_text, question)
    text, usage = complete(
        messages, model=model or DEFAULT_ASK_MODEL, feature="ask"
    )
    logger.info(
        "ask_document: document_id=%s in=%d out=%d cost=%.6f",
        document_id,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_usd,
    )
    return {
        "document_id": document_id,
        "question": question,
        "text": text,
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "model": model or DEFAULT_ASK_MODEL,
    }


# =============================================================================
# Filler detection — LLM marks low-info segments as skippable
# =============================================================================


@shared_task(name="app.tasks.ai.detect_fillers", queue="ai")
def detect_fillers(
    document_text: str,
    document_id: str,
    *,
    model: str | None = None,
) -> dict:
    """Return paragraph/sentence anchors the player can auto-skip."""
    messages, schema = filler_messages(document_text)
    text, usage = complete(
        messages,
        model=model or DEFAULT_FILLER_MODEL,
        feature="fillers",
        json_schema=schema,
    )
    parsed = _parse_json_safely(text)
    logger.info(
        "detect_fillers: document_id=%s count=%d",
        document_id,
        len(parsed.get("fillers", [])),
    )
    return {
        "document_id": document_id,
        "fillers": parsed.get("fillers", []),
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": usage.cost_usd,
            "provider": usage.provider,
        },
        "model": model or DEFAULT_FILLER_MODEL,
    }