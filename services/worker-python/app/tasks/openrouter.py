"""Shared OpenRouter HTTP client.

We use OpenRouter (https://openrouter.ai/) as our single LLM gateway so one
API key can route to any provider — OpenAI, Anthropic, Google, Meta, Mistral,
etc. — with automatic fallback. Endpoints used:

  POST https://openrouter.ai/api/v1/chat/completions   (non-streaming)
  POST https://openrouter.ai/api/v1/chat/completions   (streaming, SSE)

Per docs/UI-UX.md §7 ("AI features are servants, not stars") the helpers in
this module always propagate the source-citation rule through the system
prompt and never silently rewrite meaning.

Keeping the client here (not in `app.tasks.ai`) means `app.tasks.podcast`
shares the exact same code path for prompt construction and token accounting.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

logger = logging.getLogger("readmaxxing.openrouter")

OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT_S = 60.0


def _settings_or_env() -> tuple[str, str, str, str]:
    """Read API key + app metadata from Settings, falling back to env vars.

    We import Settings lazily to avoid a circular import (Settings itself
    imports pydantic, and tests can override env before this runs).
    """
    try:
        from app.config import get_settings  # local import

        s = get_settings()
        return (
            s.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", ""),
            s.openrouter_default_model or os.getenv("OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini"),
            s.openrouter_app_title or os.getenv("OPENROUTER_APP_TITLE", "ReadMaxxing"),
            s.openrouter_referer or os.getenv("OPENROUTER_REFERER", "https://readmaxxing.app"),
        )
    except Exception:
        return (
            os.getenv("OPENROUTER_API_KEY", ""),
            os.getenv("OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini"),
            os.getenv("OPENROUTER_APP_TITLE", "ReadMaxxing"),
            os.getenv("OPENROUTER_REFERER", "https://readmaxxing.app"),
        )


def get_api_key() -> str:
    key, _model, _title, _referer = _settings_or_env()
    if not key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Add it to .env (see README)."
        )
    return key


def _build_headers() -> dict[str, str]:
    _key, _model, title, referer = _settings_or_env()
    return {
        "Authorization": f"Bearer {get_api_key()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "HTTP-Referer": referer,
        "X-Title": title,
    }


def _default_model() -> str:
    _, model, _t, _r = _settings_or_env()
    return model


@dataclass(slots=True)
class TokenUsage:
    """Token accounting returned by OpenRouter."""

    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    provider: str | None = None


@dataclass(slots=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


def _build_body(
    messages: list[ChatMessage],
    model: str | None,
    temperature: float | None,
    max_tokens: int | None,
    stream: bool,
    json_schema: dict | None,
    feature: str | None,
) -> dict:
    body: dict = {
        "model": model or _default_model(),
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "stream": stream,
    }
    if temperature is not None:
        body["temperature"] = temperature
    if max_tokens is not None:
        body["max_tokens"] = max_tokens
    if json_schema is not None:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": json_schema["name"],
                "schema": json_schema["schema"],
                "strict": json_schema.get("strict", True),
            },
        }
    if feature:
        body["metadata"] = {"feature": feature}
    return body


def _parse_usage(payload: dict) -> TokenUsage:
    usage = payload.get("usage") or {}
    return TokenUsage(
        input_tokens=int(usage.get("prompt_tokens") or 0),
        output_tokens=int(usage.get("completion_tokens") or 0),
        cost_usd=float(usage.get("cost") or 0.0),
        provider=payload.get("provider"),
    )


def _format_error(status: int, body: str) -> str:
    try:
        data = json.loads(body)
        if isinstance(data, dict) and data.get("error"):
            err = data["error"]
            if isinstance(err, dict) and "message" in err:
                return f"{status} {err['message']}"
            return f"{status} {err!r}"
    except (ValueError, TypeError):
        pass
    return f"{status} {body[:300]}"


def complete(
    messages: list[ChatMessage],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    json_schema: dict | None = None,
    feature: str | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> tuple[str, TokenUsage]:
    """Non-streaming chat completion.

    Returns the assistant text content and the token usage reported by
    OpenRouter. Raises `RuntimeError` on transport / API failure.
    """
    body = _build_body(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=False,
        json_schema=json_schema,
        feature=feature,
    )
    with httpx.Client(timeout=timeout_s) as client:
        resp = client.post(OPENROUTER_BASE, headers=_build_headers(), json=body)
    if resp.status_code >= 400:
        raise RuntimeError(f"openrouter: {_format_error(resp.status_code, resp.text)}")

    payload = resp.json()
    usage = _parse_usage(payload)
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("openrouter: response contained no choices")
    content = (choices[0].get("message") or {}).get("content") or ""
    return content, usage


async def acomplete(
    messages: list[ChatMessage],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    json_schema: dict | None = None,
    feature: str | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> tuple[str, TokenUsage]:
    """Async non-streaming completion (used inside FastAPI handlers)."""
    body = _build_body(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=False,
        json_schema=json_schema,
        feature=feature,
    )
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        resp = await client.post(OPENROUTER_BASE, headers=_build_headers(), json=body)
    if resp.status_code >= 400:
        raise RuntimeError(f"openrouter: {_format_error(resp.status_code, resp.text)}")

    payload = resp.json()
    usage = _parse_usage(payload)
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("openrouter: response contained no choices")
    content = (choices[0].get("message") or {}).get("content") or ""
    return content, usage


async def astream(
    messages: list[ChatMessage],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    feature: str | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> AsyncIterator[str]:
    """Async streaming completion. Yields decoded text deltas."""
    body = _build_body(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
        json_schema=None,
        feature=feature,
    )

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        async with client.stream(
            "POST",
            OPENROUTER_BASE,
            headers=_build_headers(),
            json=body,
        ) as resp:
            if resp.status_code >= 400:
                text = await resp.aread()
                raise RuntimeError(
                    f"openrouter: {_format_error(resp.status_code, text.decode('utf-8', errors='replace'))}"
                )

            buffer = ""
            async for chunk in resp.aiter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    raw_event, buffer = buffer.split("\n\n", 1)
                    data_lines = [
                        line[len("data:") :].lstrip()
                        for line in raw_event.split("\n")
                        if line.startswith("data:")
                    ]
                    data = "\n".join(data_lines).strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        payload = json.loads(data)
                    except ValueError:
                        continue
                    choices = payload.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0].get("delta") or {}).get("content")
                    if delta:
                        yield delta


# =============================================================================
# Prompt helpers — these mirror the ones in packages/ai/src/index.ts so the
# Python worker and the TypeScript BFF produce consistent output.
# =============================================================================

CITE_RULE = (
    "Every factual claim must cite the source segment using a tag of the form "
    "[cite:paragraphIndex:sentenceIndex] (zero-indexed). If a claim is not "
    "supported by the source, omit it. Never invent citations."
)


def summary_messages(document_text: str, *, style: str = "default") -> list[ChatMessage]:
    system = (
        "You are ReadMaxxing's summarizer. Produce a layered summary:\n"
        "1) TL;DR — one sentence, ≤ 25 words.\n"
        "2) Key points — 3 to 6 bullets, each ≤ 25 words.\n"
        "3) Detailed — a short paragraph (≤ 120 words) for users who want more.\n"
        f"Style: {style}.\n{CITE_RULE}"
    )
    user = f"SOURCE DOCUMENT:\n---\n{document_text}\n---\n\nReturn the summary."
    return [ChatMessage("system", system), ChatMessage("user", user)]


def quiz_messages(
    document_text: str, *, question_count: int = 5
) -> tuple[list[ChatMessage], dict]:
    system = (
        f"You write retrieval-practice quizzes. Generate {question_count} "
        "multiple-choice questions that test recall of important facts from "
        "the document. Each question must have exactly 4 choices and one "
        "correct answer. Frame the questions as 'test yourself' — never trick "
        f"questions. Cite the source segment for each answer.\n{CITE_RULE}"
    )
    user = f"SOURCE DOCUMENT:\n---\n{document_text}\n---\n\nReturn the quiz."
    schema = {
        "name": "quiz",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "questions": {
                    "type": "array",
                    "minItems": question_count,
                    "maxItems": question_count,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "prompt": {"type": "string"},
                            "choices": {
                                "type": "array",
                                "minItems": 4,
                                "maxItems": 4,
                                "items": {"type": "string"},
                            },
                            "answerIndex": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 3,
                            },
                            "citation": {"type": "string"},
                        },
                        "required": [
                            "prompt",
                            "choices",
                            "answerIndex",
                            "citation",
                        ],
                    },
                }
            },
            "required": ["questions"],
        },
    }
    return [ChatMessage("system", system), ChatMessage("user", user)], schema


def recap_messages(
    document_text: str,
    *,
    last_paragraph_index: int,
    last_sentence_index: int,
) -> list[ChatMessage]:
    system = (
        "You write short, specific recaps so a returning reader knows exactly "
        "where they left off and what comes next. Recap must be ≤ 2 sentences, "
        "≤ 50 words total. Never invent details not in the source.\n"
        f"{CITE_RULE}"
    )
    user = (
        f"The reader stopped at paragraph {last_paragraph_index}, "
        f"sentence {last_sentence_index}.\n\n"
        f"SOURCE DOCUMENT (truncated to the next ~500 chars after that anchor):\n"
        f"---\n{document_text}\n---\n\nWrite the recap."
    )
    return [ChatMessage("system", system), ChatMessage("user", user)]


def ask_messages(document_text: str, question: str) -> list[ChatMessage]:
    system = (
        "You answer questions about a single document. You may only use facts "
        "present in the source. If the source does not contain the answer, "
        "say 'The document does not address that.' Never invent.\n"
        f"{CITE_RULE}"
    )
    user = (
        f"QUESTION: {question}\n\n"
        f"SOURCE DOCUMENT:\n---\n{document_text}\n---\n\nAnswer the question."
    )
    return [ChatMessage("system", system), ChatMessage("user", user)]


def filler_messages(document_text: str) -> tuple[list[ChatMessage], dict]:
    system = (
        "You identify low-information 'filler' sentences (transitions, "
        "re-statements, throat-clearing) that a reader/listener could safely "
        "skip without losing meaning. Output is a list of paragraphIndex/"
        "sentenceIndex pairs that are skippable."
    )
    user = (
        f"SOURCE DOCUMENT:\n---\n{document_text}\n---\n\n"
        "Return the list of skippable sentence anchors."
    )
    schema = {
        "name": "fillers",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "fillers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "paragraphIndex": {"type": "integer", "minimum": 0},
                            "sentenceIndex": {"type": "integer", "minimum": 0},
                            "reason": {"type": "string"},
                        },
                        "required": ["paragraphIndex", "sentenceIndex", "reason"],
                    },
                }
            },
            "required": ["fillers"],
        },
    }
    return [ChatMessage("system", system), ChatMessage("user", user)], schema


def podcast_script_messages(
    document_text: str, *, style: str, depth: str
) -> list[ChatMessage]:
    style_descriptions = {
        "podcast": "two hosts in a casual, curious conversation",
        "late_night": "two hosts in an intimate late-night radio format",
        "debate": "two hosts with opposing viewpoints debating the topic",
        "lecture": "a single expert lecturer walking the listener through the material",
    }
    style_desc = style_descriptions.get(style, style_descriptions["podcast"])
    system = (
        "You write podcast scripts for ReadMaxxing. The script must:\n"
        f"- Use the {style_desc} format.\n"
        f"- Aim for {depth} depth (brief=2-3 min, normal=6-10 min, deep=15-25 min).\n"
        "- Alternate speakers between host lines (H1, H2) — use a single host for 'lecture'.\n"
        "- Always cite a source segment using [cite:p:s] for any factual claim.\n"
        "- End with a one-line 'Sign-off' that gently invites the listener to continue reading.\n"
        "Output JSON: { \"title\": str, \"lines\": [ { \"speaker\": \"H1\"|\"H2\"|\"H1+2\", \"text\": str } ], "
        "\"signoff\": str }.\n"
        f"{CITE_RULE}"
    )
    user = (
        f"STYLE: {style}\nDEPTH: {depth}\n\n"
        f"SOURCE DOCUMENT:\n---\n{document_text}\n---\n\nReturn the JSON script."
    )
    return [ChatMessage("system", system), ChatMessage("user", user)]