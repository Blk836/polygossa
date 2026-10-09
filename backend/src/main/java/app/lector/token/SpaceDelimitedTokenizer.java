package app.lector.token;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Splits space-delimited languages on whitespace and punctuation, keeping the separators as non-word tokens. */
final class SpaceDelimitedTokenizer {

    private static final String LETTERS = "[\\p{L}\\p{M}]+";

    /**
     * Words joined by internal apostrophes or hyphens ("don't", "c'est", "dell'anno", "arc-en-ciel"): one word in
     * every language, so clicking an elision looks up the whole word. An apostrophe not between letters is punctuation.
     */
    private static final Pattern WORD = Pattern.compile(LETTERS + "(?:['’\\-]" + LETTERS + ")*");

    private SpaceDelimitedTokenizer() {}

    static List<RawToken> tokenize(Language language, String text) {
        List<RawToken> tokens = new ArrayList<>();
        Matcher m = WORD.matcher(text);
        int last = 0;
        while (m.find()) {
            if (m.start() > last) {
                tokens.add(RawToken.other(text.substring(last, m.start())));
            }
            tokens.add(RawToken.word(m.group()));
            last = m.end();
        }
        if (last < text.length()) {
            tokens.add(RawToken.other(text.substring(last)));
        }
        return tokens;
    }
}
