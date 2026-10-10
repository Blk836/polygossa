package app.lector;

import app.lector.writing.MutableClock;
import java.time.Clock;
import java.time.Instant;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

public final class TestClock implements BeforeEachCallback {

    public static final MutableClock CLOCK = new MutableClock();
    public static final Instant START = CLOCK.instant();

    @Override
    public void beforeEach(ExtensionContext context) {
        CLOCK.set(START);
    }

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }
}
