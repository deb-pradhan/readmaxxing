"""Document parsing → SegmentTree.

This module mirrors the TypeScript builder in
`packages/core/src/pipeline/segment-tree.ts` so the same canonical
representation is produced regardless of whether parsing happens in the
browser (web) or the worker (Python). The model is paragraph → sentence →
word with character offsets into the original text — powering karaoke
highlighting, AI summaries, podcast scripts, and search.

Sentence segmentation is a small rule-based splitter tuned for English. It
matches the same abbreviation set as the TS version. For more languages we
recommend `nltk.sent_tokenize` (already in `requirements.txt`).
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import asdict, dataclass, field

from celery import shared_task

logger = logging.getLogger("readmaxxing.parse")

WORDS_PER_MINUTE = 155

HEADING_PREFIX = re.compile(r"^(#{1,6})\s+")
LIST_PREFIX = re.compile(r"^\s*[-*+]\s+")
NUM_LIST_PREFIX = re.compile(r"^\s*\d+\.\s+")
BLOCKQUOTE_PREFIX = re.compile(r"^\s*>\s?")

SENTENCE_BOUNDARY_RE = re.compile(r"([.!?])(['\"\u2019\u201d)\]]*)\s+")
WORD_RE = re.compile(
    r"[\u2018\u2019\u201c\u201d\"'([]*"
    r"([^\s\u2018\u2019\u201c\u201d\"',.;:!?()\[\]]+)"
    r"([.,;:!?\u2019\u201d)\]]*)"
)

ABBREVIATIONS = frozenset(
    {
        "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
        "vs", "etc", "e.g", "i.e", "no", "inc", "ltd", "co",
    }
)


@dataclass(slots=True)
class Word:
    text: str
    start: int
    end: int
    index: int


@dataclass(slots=True)
class Sentence:
    text: str
    start: int
    end: int
    index: int
    words: list[Word] = field(default_factory=list)


@dataclass(slots=True)
class Paragraph:
    text: str
    start: int
    end: int
    index: int
    headingLevel: int
    sentences: list[Sentence] = field(default_factory=list)


@dataclass(slots=True)
class SegmentTree:
    segmentTreeId: str
    documentId: str
    title: str | None
    author: str | None
    language: str
    text: str
    paragraphs: list[Paragraph]
    createdAt: str
    wordCount: int
    estimatedReadTimeSeconds: int


def _tokenize_sentence(sentence_text: str, sentence_start: int) -> list[Word]:
    words: list[Word] = []
    idx = 0
    for match in WORD_RE.finditer(sentence_text):
        prefix = match.group(1) or ""
        suffix = match.group(2) or ""
        word_text = prefix + suffix
        if not word_text:
            continue
        start = sentence_start + match.start()
        words.append(
            Word(text=word_text, start=start, end=start + len(word_text), index=idx)
        )
        idx += 1
    return words


def _split_paragraph(paragraph_text: str, paragraph_start: int) -> list[Sentence]:
    sentences: list[Sentence] = []
    cursor = 0
    sentence_idx = 0

    while cursor < len(paragraph_text):
        remaining = paragraph_text[cursor:]
        boundary = SENTENCE_BOUNDARY_RE.search(remaining)
        if boundary is None:
            text = paragraph_text[cursor:]
            start = paragraph_start + cursor
            if text.strip():
                words = _tokenize_sentence(text, start)
                if words:
                    sentences.append(
                        Sentence(
                            text=text,
                            start=start,
                            end=paragraph_start + len(paragraph_text),
                            index=sentence_idx,
                            words=words,
                        )
                    )
                    sentence_idx += 1
            break

        end_idx = cursor + boundary.end()

        # Check the token immediately before the terminator to guard
        # against abbreviations like "Dr.", "Mr.", "e.g.".
        preceding = paragraph_text[: cursor + boundary.start()]
        token_match = re.search(r"(\S+)$", preceding)
        last_token = token_match.group(1) if token_match else ""
        stripped = re.sub(r"[.,;:!?\u2019\u201d)\]]+$", "", last_token).lower()
        if stripped in ABBREVIATIONS:
            # Move past this terminator and look for the next one.
            cursor = cursor + boundary.end()
            continue

        text = paragraph_text[cursor:end_idx]
        start = paragraph_start + cursor
        words = _tokenize_sentence(text, start)
        if words:
            sentences.append(
                Sentence(
                    text=text,
                    start=start,
                    end=start + len(text),
                    index=sentence_idx,
                    words=words,
                )
            )
            sentence_idx += 1
        cursor = end_idx

    return sentences


def _normalize_input(text: str) -> tuple[str, str | None, str | None]:
    """Mirror TS `normalizeInput`: strip BOM/CRLF, optional Title:/Author:, collapse blank lines."""
    t = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")

    title: str | None = None
    author: str | None = None

    title_match = re.match(r"^Title:\s*(.+)\n", t)
    if title_match:
        title = title_match.group(1).strip()
        t = t[title_match.end():]

    author_match = re.match(r"^Author:\s*(.+)\n", t)
    if author_match:
        author = author_match.group(1).strip()
        t = t[author_match.end():]

    t = re.sub(r"\n{3,}", "\n\n", t)
    return t, title, author


def build_segment_tree(
    raw_text: str, *, document_id: str, language: str = "en"
) -> SegmentTree:
    """Build a SegmentTree from raw text — Python mirror of the TS builder."""
    text, title, author = _normalize_input(raw_text)
    paragraph_strings = re.split(r"\n\s*\n", text)

    paragraphs: list[Paragraph] = []
    cursor = 0
    paragraph_idx = 0
    total_words = 0

    for raw in paragraph_strings:
        trimmed = raw.strip()
        if not trimmed:
            continue

        # Account for the original whitespace between paragraphs in the cursor.
        leading_whitespace = re.match(r"^\s*", raw).group(0)
        cursor += len(leading_whitespace)

        heading_level = 0
        body = trimmed
        heading_match = HEADING_PREFIX.match(body)
        if heading_match:
            heading_level = min(6, len(heading_match.group(1)))
            body = body[heading_match.end():]
        elif LIST_PREFIX.match(body) or NUM_LIST_PREFIX.match(body):
            body = LIST_PREFIX.sub("", body)
            body = NUM_LIST_PREFIX.sub("", body)
        elif BLOCKQUOTE_PREFIX.match(body):
            body = BLOCKQUOTE_PREFIX.sub("", body)

        start = cursor
        end = start + len(trimmed)
        sentences = _split_paragraph(body, start)
        word_count = sum(len(s.words) for s in sentences)
        total_words += word_count

        paragraphs.append(
            Paragraph(
                text=trimmed,
                start=start,
                end=end,
                index=paragraph_idx,
                headingLevel=heading_level,
                sentences=sentences,
            )
        )
        paragraph_idx += 1
        cursor = end + 2  # the blank line (\n\n) consumed between paragraphs

    segment_tree_id = hashlib.sha1(text.encode("utf-8")).hexdigest()

    from datetime import datetime, timezone

    return SegmentTree(
        segmentTreeId=segment_tree_id,
        documentId=document_id,
        title=title,
        author=author,
        language=language,
        text=text,
        paragraphs=paragraphs,
        createdAt=datetime.now(timezone.utc).isoformat(),
        wordCount=total_words,
        estimatedReadTimeSeconds=round((total_words / WORDS_PER_MINUTE) * 60),
    )


def segment_tree_to_dict(tree: SegmentTree) -> dict:
    """Convert a SegmentTree (and its nested children) into a JSON-safe dict."""
    return asdict(tree)


# =============================================================================
# Celery task
# =============================================================================


@shared_task(name="app.tasks.parse.parse_document", queue="parse")
def parse_document(
    document_id: str,
    text: str,
    source_type: str = "paste",
    language: str = "en",
) -> dict:
    """Build a SegmentTree for the given text.

    Args:
      document_id: the upstream document id (kept on the SegmentTree).
      text: the source text (already extracted from PDF/DOCX/etc. upstream).
      source_type: one of "paste" | "url" | "pdf" | "docx" | "md" | "epub" | "txt".
        Used for analytics only — does not affect the tree shape.
      language: BCP-47 language tag, defaults to "en".

    Returns:
      A dict shape identical to the TS SegmentTree, ready to persist into the
      `Document.segmentTree` JSONB column.
    """
    logger.info(
        "parse_document: id=%s source_type=%s len=%d", document_id, source_type, len(text)
    )
    tree = build_segment_tree(text, document_id=document_id, language=language)
    return segment_tree_to_dict(tree)