package app.lector.text;

import app.lector.text.TextDtos.KnownStats;
import app.lector.token.Token;
import app.lector.vocab.WordStatus;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

final class KnownWords {

    private KnownWords() {}

    static String wordsJson(List<Token> tokens, ObjectMapper json) {
        return json.writeValueAsString(UniqueWordsCache.distinct(tokens));
    }

    static Set<String> readWords(String wordsJson, ObjectMapper json) {
        return new LinkedHashSet<>(json.readValue(wordsJson, new TypeReference<List<String>>() {}));
    }

    static KnownStats stats(List<Token> tokens, Map<String, WordStatus> statuses, Set<String> names) {
        return stats(UniqueWordsCache.distinct(tokens), statuses, names);
    }

    static WordStatus status(String term, Map<String, WordStatus> statuses, Set<String> names) {
        WordStatus s = statuses.get(term);
        return s == null && names.contains(term) ? WordStatus.IGNORED : s;
    }

    static Map<String, WordStatus> statuses(List<Token> tokens, Map<String, WordStatus> all) {
        Map<String, WordStatus> out = new LinkedHashMap<>();
        for (Token t : tokens) {
            if (t.word() && all.containsKey(t.normalized())) {
                out.put(t.normalized(), all.get(t.normalized()));
            }
        }
        return out;
    }

    static List<String> namesToShow(List<Token> tokens, Map<String, WordStatus> all, Set<String> names) {
        Set<String> out = new LinkedHashSet<>();
        for (Token t : tokens) {
            if (t.word() && names.contains(t.normalized()) && !all.containsKey(t.normalized())) {
                out.add(t.normalized());
            }
        }
        return List.copyOf(out);
    }

    static KnownStats stats(Set<String> unique, Map<String, WordStatus> statuses, Set<String> names) {
        int known = 0;
        int learning = 0;
        int ignored = 0;
        for (String term : unique) {
            WordStatus s = status(term, statuses, names);
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
        double pct = total == 0 ? 0 : Math.round(1000.0 * (known + ignored) / total) / 10.0;
        return new KnownStats(total, known, learning, ignored, unseen, pct);
    }
}
