"""Segment-tree parity test — Python builder must produce the same offsets
as the TypeScript builder.

These tests pin the contract that powers the web/Python data exchange
(Phase 2 wiring will sync segment trees across the BFF/worker). If a
change to the tokenization rules breaks the shape, these tests fail
loudly.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make the services/worker-python/app package importable when running
# pytest from the repo root.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.tasks.parse import build_segment_tree  # noqa: E402


def test_single_sentence_word_count() -> None:
    tree = build_segment_tree("Hello world.", document_id="doc-1")
    assert tree.wordCount == 2
    assert len(tree.paragraphs) == 1
    assert len(tree.paragraphs[0].sentences) == 1
    texts = [w.text for w in tree.paragraphs[0].sentences[0].words]
    assert texts == ["Hello", "world."]


def test_offsets_index_into_source_text() -> None:
    tree = build_segment_tree("Hello world.", document_id="doc-1")
    words = tree.paragraphs[0].sentences[0].words
    assert tree.text[words[0].start : words[0].end] == "Hello"
    assert tree.text[words[1].start : words[1].end] == "world."


def test_paragraph_split_on_blank_lines() -> None:
    tree = build_segment_tree("First paragraph.\n\nSecond paragraph.", document_id="doc-1")
    assert len(tree.paragraphs) == 2
    assert tree.paragraphs[0].text == "First paragraph."
    assert tree.paragraphs[1].text == "Second paragraph."


def test_abbreviations_do_not_split_sentences() -> None:
    text = "Dr. Smith met Mr. Jones at 5 p.m. Did they talk? Yes!"
    tree = build_segment_tree(text, document_id="doc-1")
    joined = " ".join(s.text.strip() for p in tree.paragraphs for s in p.sentences)
    # Abbreviations stay attached to their owning sentence.
    assert "Dr. Smith" in joined
    assert "Mr. Jones" in joined
    # True terminators still split.
    assert "Did they talk?" in joined
    assert "Yes!" in joined


def test_estimated_read_time_at_wpm() -> None:
    tree = build_segment_tree(
        "one two three four five six seven eight nine ten", document_id="doc-1"
    )
    assert tree.wordCount == 10
    # 10 / 155 wpm ≈ 4 s
    assert 3 <= tree.estimatedReadTimeSeconds <= 5


def test_content_hash_dedupes_identical_input() -> None:
    a = build_segment_tree("Same text.", document_id="doc-1")
    b = build_segment_tree("Same text.", document_id="doc-2")
    assert a.segmentTreeId == b.segmentTreeId


def test_markdown_heading_carries_level() -> None:
    tree = build_segment_tree("# Heading 1\n\nBody paragraph.", document_id="doc-1")
    assert len(tree.paragraphs) == 2
    assert tree.paragraphs[0].headingLevel == 1
    assert tree.paragraphs[1].headingLevel == 0


def test_title_author_prefix_parsing() -> None:
    tree = build_segment_tree(
        "Title: My Doc\nAuthor: Jane\n\nBody text here.", document_id="doc-1"
    )
    assert tree.title == "My Doc"
    assert tree.author == "Jane"
    assert tree.text.startswith("Body text here.")


@pytest.mark.parametrize(
    "raw,expected_count",
    [
        ("Hello.", 1),
        ("One two three.", 3),
        ("First.\n\nSecond.\n\nThird.", 3),
        ("# H1\n\nbody", 2),
    ],
)
def test_parametrized_counts(raw: str, expected_count: int) -> None:
    tree = build_segment_tree(raw, document_id="d")
    assert tree.wordCount == expected_count


def test_contractions_stay_single_words() -> None:
    tree = build_segment_tree("I can't go. It's yours.", document_id="doc-1")
    texts = [w.text for p in tree.paragraphs for s in p.sentences for w in s.words]
    assert texts == ["I", "can't", "go.", "It's", "yours."]


def test_contraction_offsets_index_into_source() -> None:
    tree = build_segment_tree("You're right.", document_id="doc-1")
    word = tree.paragraphs[0].sentences[0].words[0]
    assert word.text == "You're"
    assert tree.text[word.start : word.end] == "You're"


def test_apostrophe_variants_and_possessives() -> None:
    # Typographic apostrophe (U+2019), o'clock, and possessive 's all stay attached.
    tree = build_segment_tree("It’s o'clock at James's.", document_id="doc-1")
    texts = [w.text for p in tree.paragraphs for s in p.sentences for w in s.words]
    assert texts == ["It’s", "o'clock", "at", "James's."]