import importlib.util

import pytest
from fastapi.testclient import TestClient

from app.main import Token, align, app, katakana_to_hiragana

client = TestClient(app)


def surfaces(tokens):
    return "".join(t.surface for t in tokens)


def test_align_fills_gaps_and_reassembles_text():
    text = "今日は  いい天気。"
    pieces = [Token(surface=s, is_word=True) for s in ["今日", "は", "いい", "天気", "。"]]
    out = align(text, pieces)
    assert surfaces(out) == text
    assert [t.surface for t in out if not t.is_word] == ["  "]


def test_align_skips_pieces_not_found_in_text():
    out = align("abc", [Token(surface="x", is_word=True), Token(surface="b", is_word=True)])
    assert surfaces(out) == "abc"
    assert [t.surface for t in out] == ["a", "b", "c"]


def test_katakana_to_hiragana():
    assert katakana_to_hiragana("タベル") == "たべる"
    assert katakana_to_hiragana("コーヒー") == "こーひー"


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_rejects_unsupported_language():
    assert client.post("/tokenize", json={"language": "es", "text": "hola"}).status_code == 400


@pytest.mark.skipif(importlib.util.find_spec("fugashi") is None, reason="fugashi not installed")
def test_japanese():
    text = "私は毎朝コーヒーを飲みました。"
    r = client.post("/tokenize", json={"language": "ja", "text": text}).json()
    assert surfaces([Token(**t) for t in r["tokens"]]) == text
    nomi = next(t for t in r["tokens"] if t["surface"].startswith("飲"))
    assert nomi["lemma"] == "飲む"
    assert nomi["reading"].startswith("の")


@pytest.mark.skipif(importlib.util.find_spec("jieba") is None, reason="jieba not installed")
def test_chinese():
    text = "我喜欢学习中文。"
    r = client.post("/tokenize", json={"language": "zh", "text": text}).json()
    assert surfaces([Token(**t) for t in r["tokens"]]) == text
    words = [t["surface"] for t in r["tokens"] if t["is_word"]]
    assert "喜欢" in words
    assert next(t for t in r["tokens"] if t["surface"] == "喜欢")["reading"] == "xǐ huan"


@pytest.mark.skipif(importlib.util.find_spec("konlpy") is None, reason="konlpy not installed")
def test_korean():
    text = "저는 카페에 갔어요."
    r = client.post("/tokenize", json={"language": "ko", "text": text}).json()
    assert surfaces([Token(**t) for t in r["tokens"]]) == text
    assert any(t["surface"] == "카페" for t in r["tokens"])
