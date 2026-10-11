package app.lector.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.writing.MutableClock;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    private final MutableClock clock = new MutableClock();

    private RateLimiter limiter(boolean enabled) {
        return new RateLimiter(clock, new RateLimitProperties(enabled, 3, 2));
    }

    @Test
    void allowsUpToTheLimitInAWindowThenRefuses() {
        RateLimiter limiter = limiter(true);
        for (int i = 0; i < 3; i++) {
            limiter.check(RateLimiter.Bucket.LOOKUPS, 1L);
        }
        assertThatThrownBy(() -> limiter.check(RateLimiter.Bucket.LOOKUPS, 1L))
                .isInstanceOfSatisfying(RateLimiter.LimitedException.class,
                        e -> assertThat(e.retryAfter()).isBetween(Duration.ofSeconds(1), Duration.ofMinutes(1)));
    }

    @Test
    void bucketsAndUsersCountSeparately() {
        RateLimiter limiter = limiter(true);
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        limiter.check(RateLimiter.Bucket.IMPORTS, 2L);
        limiter.check(RateLimiter.Bucket.LOOKUPS, 1L);
        assertThatThrownBy(() -> limiter.check(RateLimiter.Bucket.IMPORTS, 1L))
                .isInstanceOf(RateLimiter.LimitedException.class);
    }

    @Test
    void theNextWindowStartsAfresh() {
        RateLimiter limiter = limiter(true);
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        clock.advance(Duration.ofHours(1));
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
    }

    @Test
    void oldWindowsAreForgotten() {
        RateLimiter limiter = limiter(true);
        for (long user = 0; user < 100; user++) {
            limiter.check(RateLimiter.Bucket.LOOKUPS, user);
        }
        clock.advance(Duration.ofHours(2));
        limiter.check(RateLimiter.Bucket.LOOKUPS, 1L);
        assertThat(limiter.tracked()).isEqualTo(1);
    }

    @Test
    void switchedOffNothingIsLimited() {
        RateLimiter limiter = limiter(false);
        for (int i = 0; i < 100; i++) {
            limiter.check(RateLimiter.Bucket.IMPORTS, 1L);
        }
        assertThat(limiter.tracked()).isZero();
    }
}
