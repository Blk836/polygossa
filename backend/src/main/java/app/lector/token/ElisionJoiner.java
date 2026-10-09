package app.lector.token;

import java.util.ArrayList;
import java.util.List;

/**
 * Joins the elisions that texts tokenized before elisions stayed one word still hold split ("l'" + "homme" →
 * "l'homme"), merging the tokens rather than tokenizing again so nothing else about the text changes.
 */
public final class ElisionJoiner {

    /**
     * @param tokens   the joined tokens, re-indexed
     * @param newIndex for each old token index, the index of the token it is now part of
     */
    public record Joined(List<Token> tokens, int[] newIndex) {

        public boolean changed() {
            return tokens.size() != newIndex.length;
        }
    }

    private ElisionJoiner() {}

    public static Joined join(Language language, List<Token> tokens) {
        List<Token> out = new ArrayList<>(tokens.size());
        int[] newIndex = new int[tokens.size()];
        for (int i = 0; i < tokens.size(); i++) {
            Token token = tokens.get(i);
            newIndex[i] = out.size();
            Token previous = out.isEmpty() ? null : out.getLast();
            if (token.word() && previous != null && previous.word() && endsWithApostrophe(previous.text())) {
                String text = previous.text() + token.text();
                out.set(out.size() - 1, new Token(previous.index(), text, true,
                        TokenizationService.normalize(text, language), null, null, previous.sentence()));
                newIndex[i] = out.size() - 1;
            } else {
                out.add(new Token(out.size(), token.text(), token.word(), token.normalized(), token.lemma(),
                        token.reading(), token.sentence()));
            }
        }
        return new Joined(out.size() == tokens.size() ? tokens : out, newIndex);
    }

    private static boolean endsWithApostrophe(String text) {
        return text.endsWith("'") || text.endsWith("’");
    }
}
