package app.lector.text;

import app.lector.text.TextDtos.KnownStats;
import app.lector.token.Token;
import app.lector.vocab.WordStatus;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** How much of a text's vocabulary a reader already knows. */
final class KnownWords {

    private KnownWords() {}

    static KnownStats stats(List<Token> tokens, Map<String, WordStatus> statuses) {
        Set<String> unique = new LinkedHashSet<>();
        for (Token t : tokens) {
            if (t.word()) {
                unique.add(t.normalized());
            }
        }
        int known = 0;
        int learning = 0;
        int ignored = 0;
        for (String term : unique) {
            WordStatus s = statuses.get(term);
            if (s == WordStatus.KNOWN) {
                known++;
            } else if (s == WordStatus.LEARNING) {
                learning++;
            } else if (s == WordStatus.IGNORED) {
                ignored++;
            }
        }
        int total = unique.size();
        int unseen = total - known - learning - ignored;
        // Ignored words (names etc.) don't need learning, so they count toward comprehension.
        double pct = total == 0 ? 0 : Math.round(1000.0 * (known + ignored) / total) / 10.0;
        return new KnownStats(total, known, learning, ignored, unseen, pct);
    }
}
