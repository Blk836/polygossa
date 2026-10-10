package app.lector.video;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

final class RecentAnswers<V> {

    static final int MAX = 500;

    private record Stored<V>(V value, Instant at) {}

    private final Duration ttl;
    private final Clock clock;
    private final Predicate<V> keep;
    private final Map<String, Stored<V>> entries = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Stored<V>> eldest) {
            return size() > MAX;
        }
    };

    RecentAnswers(Duration ttl, Clock clock, Predicate<V> keep) {
        this.ttl = ttl;
        this.clock = clock;
        this.keep = keep;
    }

    V get(String key, Function<String, V> ask) {
        if (ttl.isZero() || ttl.isNegative()) {
            return ask.apply(key);
        }
        Instant now = clock.instant();
        synchronized (entries) {
            Stored<V> e = entries.get(key);
            if (e != null && now.isBefore(e.at().plus(ttl))) {
                return e.value();
            }
        }
        V value = ask.apply(key);
        if (keep.test(value)) {
            synchronized (entries) {
                entries.put(key, new Stored<>(value, now));
            }
        }
        return value;
    }
}
