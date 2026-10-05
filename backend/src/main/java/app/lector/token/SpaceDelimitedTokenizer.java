package app.lector.token;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Splits space-delimited languages on whitespace and punctuation, keeping the separators as non-word tokens. */
final class SpaceDelimitedTokenizer {

    private static final String LETTERS = "[\\p{L}\\p{M}]+";

    /** Words joined by internal apostrophes or hyphens ("don't", "arc-en-ciel", "Baden-Württemberg"). */
    private static final Pattern WORD = Pattern.compile(LETTERS + "(?:['’\\-]" + LETTERS + ")*");

    /** French/Italian elisions are their own word: "l'homme" → "l'" + "homme", "dell'anno" → "dell'" + "anno". */
    private static final Pattern ELIDING_WORD =
            Pattern.compile(LETTERS + "['’](?=[\\p{L}\\p{M}])|" + LETTERS + "(?:-" + LETTERS + ")*");

    private SpaceDelimitedTokenizer() {}

    static List<RawToken> tokenize(Language language, String text) {
        Pattern pattern = language == Language.FR || language == Language.IT ? ELIDING_WORD : WORD;
        List<RawToken> tokens = new ArrayList<>();
        Matcher m = pattern.matcher(text);
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
