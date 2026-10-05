package app.lector.text;

import app.lector.text.TextDtos.KnownStats;
import app.lector.token.Token;
import app.lector.vocab.WordStatus;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** How much of a text's vocabulary a reader already knows. */
final class KnownWords {

    private KnownWords() {}

    /** The distinct normalised words of these tokens, as the JSON stored on the text for its card. */
    static String wordsJson(List<Token> tokens, ObjectMapper json) {
        return json.writeValueAsString(UniqueWordsCache.distinct(tokens));
    }

    /** Reads {@link #wordsJson}'s output back. */
    static Set<String> readWords(String wordsJson, ObjectMapper json) {
        return new LinkedHashSet<>(json.readValue(wordsJson, new TypeReference<List<String>>() {}));
    }

    static KnownStats stats(List<Token> tokens, Map<String, WordStatus> statuses) {
        return stats(UniqueWordsCache.distinct(tokens), statuses);
    }

    /** The stats for a text's distinct normalised words. */
    static KnownStats stats(Set<String> unique, Map<String, WordStatus> statuses) {
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
