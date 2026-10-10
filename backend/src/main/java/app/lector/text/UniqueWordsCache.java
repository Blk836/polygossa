package app.lector.text;

import app.lector.token.Token;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class UniqueWordsCache {

    private static final int DEFAULT_MAX_TEXTS = 5_000;

    private record Cached(int length, int hash, Set<String> words) {
        boolean matches(String wordsJson) {
            return length == wordsJson.length() && hash == wordsJson.hashCode();
        }
    }

    private final Map<Long, Cached> entries;

    @Autowired
    public UniqueWordsCache() {
        this(DEFAULT_MAX_TEXTS);
    }

    UniqueWordsCache(int maxTexts) {
        this.entries = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Long, Cached> eldest) {
                return size() > maxTexts;
            }
        };
    }

    public Set<String> words(Long textId, String wordsJson, Function<String, Set<String>> read) {
        if (textId == null) {
            return read.apply(wordsJson);
        }
        synchronized (entries) {
            Cached cached = entries.get(textId);
            if (cached != null && cached.matches(wordsJson)) {
                return cached.words();
            }
        }
        Set<String> words = Collections.unmodifiableSet(read.apply(wordsJson));
        synchronized (entries) {
            entries.put(textId, new Cached(wordsJson.length(), wordsJson.hashCode(), words));
        }
        return words;
    }

    static Set<String> distinct(List<Token> tokens) {
        Set<String> unique = new LinkedHashSet<>();
        for (Token t : tokens) {
            if (t.word()) {
                unique.add(t.normalized());
            }
        }
        return Collections.unmodifiableSet(unique);
    }
}
