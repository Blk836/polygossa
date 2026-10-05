"""CJK tokenization sidecar.

Space-delimited languages are tokenized by the Java backend; this service handles the languages that need
morphological analysis or segmentation:

* Japanese — MeCab (via fugashi + UniDic Lite): surface, dictionary form, kana reading
* Chinese  — jieba segmentation, pypinyin readings
* Korean   — KoNLPy Okt morphological analysis, verb/adjective stems

The response always covers the input exactly: concatenating every token's ``surface`` reproduces the text, with
whitespace and punctuation returned as non-word tokens.
"""

from __future__ import annotations

import os
import unicodedata
from functools import lru_cache
from typing import Iterable

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MAX_CHARS = 100_000

# The app name (BRAND_NAME, shared with the backend and frontend), shown in the OpenAPI docs.
BRAND = (os.environ.get("BRAND_NAME") or "").strip() or "Polygossa"
app = FastAPI(title=f"{BRAND} tokenizer", version="0.1.0")


class TokenizeRequest(BaseModel):
    language: str
    text: str = Field(max_length=MAX_CHARS)


class Token(BaseModel):
    surface: str
    is_word: bool
    lemma: str | None = None
    reading: str | None = None
    pos: str | None = None


class TokenizeResponse(BaseModel):
    language: str
    tokens: list[Token]


# ---------------------------------------------------------------------------
# helpers


def has_letters(s: str) -> bool:
    """True if the string contains any letter (any script), i.e. it is something a learner can look up."""
    return any(unicodedata.category(ch).startswith("L") for ch in s)


def katakana_to_hiragana(s: str) -> str:
    return "".join(chr(ord(ch) - 0x60) if "ァ" <= ch <= "ヶ" else ch for ch in s)


def align(text: str, pieces: Iterable[Token]) -> list[Token]:
    """Places analyzer output back onto the original text.

    Analyzers drop whitespace (and sometimes normalize characters), so each piece is located from the current
    cursor; anything in between becomes a non-word token. Pieces that can't be found are skipped and their text
    ends up in the following gap, so the output always reassembles to ``text``.
    """
    out: list[Token] = []
    cursor = 0
    for piece in pieces:
        if not piece.surface:
            continue
        idx = text.find(piece.surface, cursor)
        if idx < 0:
            continue
        if idx > cursor:
            out.append(Token(surface=text[cursor:idx], is_word=False))
        out.append(piece)
        cursor = idx + len(piece.surface)
    if cursor < len(text):
        out.append(Token(surface=text[cursor:], is_word=False))
    return out


# ---------------------------------------------------------------------------
# analyzers (loaded lazily: each pulls in a sizeable dictionary)


@lru_cache(maxsize=1)
def _mecab():
    import fugashi  # MeCab binding; dictionary from unidic-lite

    return fugashi.Tagger()


@lru_cache(maxsize=1)
def _okt():
    from konlpy.tag import Okt

    return Okt()


JA_NON_WORD_POS = {"補助記号", "空白", "記号"}
KO_NON_WORD_POS = {"Punctuation", "Number", "Foreign", "URL", "Email", "Hashtag", "ScreenName"}


def tokenize_japanese(text: str) -> list[Token]:
    tagger = _mecab()
    pieces = []
    for word in tagger(text):
        f = word.feature
        pos = getattr(f, "pos1", None)
        # orthBase keeps the written form (した → する) where lemma would normalize to kanji (為る).
        lemma = getattr(f, "orthBase", None) or getattr(f, "lemma", None)
        kana = getattr(f, "kana", None)
        is_word = pos not in JA_NON_WORD_POS and has_letters(word.surface)
        pieces.append(
            Token(
                surface=word.surface,
                is_word=is_word,
                lemma=lemma if is_word and lemma and lemma != "*" else None,
                reading=katakana_to_hiragana(kana) if is_word and kana and kana != "*" else None,
                pos=pos,
            )
        )
    return align(text, pieces)


def tokenize_chinese(text: str) -> list[Token]:
    import jieba
    from pypinyin import Style, pinyin

    tokens = []
    for word, _start, _end in jieba.tokenize(text):
        is_word = has_letters(word)
        reading = " ".join(p[0] for p in pinyin(word, style=Style.TONE)) if is_word else None
        tokens.append(Token(surface=word, is_word=is_word, reading=reading))
    # jieba covers every character already, but align() also guarantees exact reconstruction.
    return align(text, tokens)


def tokenize_korean(text: str) -> list[Token]:
    okt = _okt()
    morphs = okt.pos(text, norm=False, stem=False)
    stems = okt.pos(text, norm=False, stem=True)
    use_stems = len(stems) == len(morphs)
    pieces = []
    for i, (surface, tag) in enumerate(morphs):
        is_word = tag not in KO_NON_WORD_POS and has_letters(surface)
        lemma = None
        if is_word and use_stems and tag in ("Verb", "Adjective"):
            stem = stems[i][0]
            lemma = stem if stem != surface else None
        pieces.append(Token(surface=surface, is_word=is_word, lemma=lemma, pos=tag))
    return align(text, pieces)


ANALYZERS = {"ja": tokenize_japanese, "zh": tokenize_chinese, "ko": tokenize_korean}


# ---------------------------------------------------------------------------
# routes


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize(req: TokenizeRequest) -> TokenizeResponse:
    lang = req.language.lower()
    analyzer = ANALYZERS.get(lang)
    if analyzer is None:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")
    try:
        tokens = analyzer(req.text)
    except ImportError as e:  # analyzer library missing: the backend falls back to its own segmentation
        raise HTTPException(status_code=503, detail=f"Analyzer for {lang} unavailable: {e}") from e
    return TokenizeResponse(language=lang, tokens=tokens)
