package app.lector.common;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class RateLimiter {

    public enum Bucket {
        LOOKUPS(Duration.ofMinutes(1)),
        IMPORTS(Duration.ofHours(1));

        private final Duration window;

        Bucket(Duration window) {
            this.window = window;
        }
    }

    public static class LimitedException extends ApiException {

        private final Duration retryAfter;

        LimitedException(Duration retryAfter) {
            super(HttpStatus.TOO_MANY_REQUESTS, "rate_limited",
                    "You're going a little fast. Try again in " + describe(retryAfter) + ".");
            this.retryAfter = retryAfter;
        }

        public Duration retryAfter() {
            return retryAfter;
        }

        private static String describe(Duration wait) {
            long minutes = (wait.toSeconds() + 59) / 60;
            return minutes <= 1 ? "a minute" : minutes + " minutes";
        }
    }

    private record Key(Bucket bucket, long userId) {}

    private record Window(long start, int count) {}

    private final Clock clock;
    private final RateLimitProperties props;
    private final Map<Key, Window> windows = new ConcurrentHashMap<>();
    private volatile long lastSweep;

    public RateLimiter(Clock clock, RateLimitProperties props) {
        this.clock = clock;
        this.props = props;
    }

    public void check(Bucket bucket, long userId) {
        if (!props.enabled()) {
            return;
        }
        long now = clock.millis();
        sweep(now);
        long size = bucket.window.toMillis();
        long start = Math.floorDiv(now, size) * size;
        Window window = windows.merge(new Key(bucket, userId), new Window(start, 1),
                (old, fresh) -> old.start() == start ? new Window(start, old.count() + 1) : fresh);
        if (window.count() > limit(bucket)) {
            throw new LimitedException(Duration.ofSeconds(Math.max(1, (start + size - now + 999) / 1000)));
        }
    }

    int tracked() {
        return windows.size();
    }

    private int limit(Bucket bucket) {
        return bucket == Bucket.LOOKUPS ? props.lookupsPerMinute() : props.importsPerHour();
    }

    private void sweep(long now) {
        if (now - lastSweep < Bucket.LOOKUPS.window.toMillis()) {
            return;
        }
        lastSweep = now;
        windows.entrySet().removeIf(e -> e.getValue().start() + e.getKey().bucket().window.toMillis() <= now);
    }
}
