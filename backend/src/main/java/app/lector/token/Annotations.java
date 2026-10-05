package app.lector.token;

import java.util.ArrayList;
import java.util.List;

/**
 * Caption annotations in square brackets ("[musique]", "[Applaudissements]", "［音楽］", "【拍手】") aren't part of
 * what's said, so their words become non-words: not clickable, not counted, never marked known. A bracket only counts
 * when it closes on the same line; parentheses are left alone, since in ordinary text they hold real words.
 */
public final class Annotations {

    private static final String OPENERS = "[［【";
    private static final String CLOSERS = "]］】";

    private Annotations() {}

    /** The same tokens (same indexes and text) with bracketed words turned into non-words. */
    public static List<Token> unmark(List<Token> tokens) {
        List<Token> out = new ArrayList<>(tokens);
        List<Integer> inside = null; // word positions since the last opening bracket, or null outside brackets
        for (Token t : tokens) {
            if (t.word()) {
                if (inside != null) {
                    inside.add(t.index());
                }
                continue;
            }
            inside = scan(t.text(), inside, out);
        }
        return out;
    }

    /** Follows the brackets in a non-word token; unmarks the words of each annotation that closes. */
    private static List<Integer> scan(String separator, List<Integer> inside, List<Token> out) {
        List<Integer> open = inside;
        for (int i = 0; i < separator.length(); i++) {
            char c = separator.charAt(i);
            if (OPENERS.indexOf(c) >= 0) {
                open = new ArrayList<>();
            } else if (CLOSERS.indexOf(c) >= 0 && open != null) {
                open.forEach(k -> out.set(k, asNonWord(out.get(k))));
                open = null;
            } else if (c == '\n') {
                open = null;
            }
        }
        return open;
    }

    private static Token asNonWord(Token t) {
        return new Token(t.index(), t.text(), false, null, null, null, t.sentence());
    }
}
