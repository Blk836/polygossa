package app.lector.token;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One piece of a tokenized text. Non-word tokens (whitespace, punctuation, digits) are kept so the reader can
 * render the original text faithfully.
 *
 * @param index      position in the token list
 * @param text       surface form exactly as it appears in the text
 * @param word       whether this token is a clickable word
 * @param normalized lookup key for vocabulary (lower-cased); null for non-words
 * @param lemma      dictionary form when the tokenizer knows it (CJK sidecar); may be null
 * @param reading    pronunciation hint (kana for Japanese, pinyin for Chinese); may be null
 * @param sentence   index of the sentence the token belongs to
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Token(int index, String text, boolean word, String normalized, String lemma, String reading, int sentence) {}
