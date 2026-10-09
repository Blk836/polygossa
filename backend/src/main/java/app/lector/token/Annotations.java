package app.lector.token;

import java.util.ArrayList;
import java.util.List;

public final class Annotations {

    private static final String OPENERS = "[［【";
    private static final String CLOSERS = "]］】";

    private Annotations() {}

    public static List<Token> unmark(List<Token> tokens) {
        List<Token> out = new ArrayList<>(tokens);
        List<Integer> inside = null;
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
