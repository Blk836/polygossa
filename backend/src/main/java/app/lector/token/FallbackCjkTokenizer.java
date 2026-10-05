package app.lector.token;

import java.util.ArrayList;
import java.util.List;

/**
 * Crude segmentation used when the tokenizer sidecar is unavailable: Chinese is split per character, Japanese into
 * runs of the same script, and Korean on whitespace.
 */
final class FallbackCjkTokenizer {

    private enum Script { HAN, HIRAGANA, KATAKANA, HANGUL, LATIN, OTHER }

    private FallbackCjkTokenizer() {}

    static List<RawToken> tokenize(Language language, String text) {
        List<RawToken> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        Script currentScript = null;
        int i = 0;
        while (i < text.length()) {
            int cp = text.codePointAt(i);
            Script script = scriptOf(cp);
            // Chinese words are mostly 1–2 characters with no reliable boundary cue, so split per character;
            // Japanese kanji runs (毎朝, 六時) are usually one word, so keep them together.
            boolean splitEachChar = script == Script.HAN && language == Language.ZH;
            if (current.length() > 0 && (script != currentScript || splitEachChar)) {
                flush(tokens, current, currentScript);
            }
            current.appendCodePoint(cp);
            currentScript = script;
            if (splitEachChar) {
                flush(tokens, current, currentScript);
                currentScript = null;
            }
            i += Character.charCount(cp);
        }
        if (current.length() > 0) {
            flush(tokens, current, currentScript);
        }
        return tokens;
    }

    private static void flush(List<RawToken> tokens, StringBuilder current, Script script) {
        String s = current.toString();
        current.setLength(0);
        boolean word = script != null && script != Script.OTHER;
        tokens.add(word ? RawToken.word(s) : RawToken.other(s));
    }

    private static Script scriptOf(int cp) {
        Character.UnicodeScript us;
        try {
            us = Character.UnicodeScript.of(cp);
        } catch (IllegalArgumentException e) {
            return Script.OTHER;
        }
        if (!Character.isLetter(cp) && cp != 'ー') {
            return Script.OTHER;
        }
        return switch (us) {
            case HAN -> Script.HAN;
            case HIRAGANA -> Script.HIRAGANA;
            case KATAKANA -> Script.KATAKANA;
            case HANGUL -> Script.HANGUL;
            case LATIN -> Script.LATIN;
            default -> cp == 'ー' ? Script.KATAKANA : Script.OTHER;
        };
    }
}
