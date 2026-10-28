package app.lector.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

class OpenAiSettingsTest {

    private static AppProperties.OpenAi defaults() {
        return new Binder(new MapConfigurationPropertySource(Map.of()))
                .bindOrCreate("app.openai", AppProperties.OpenAi.class);
    }

    @Test
    void eachTryAtAWordsMeaningWaitsUpTo15Seconds() {
        assertThat(defaults().meaningTimeout()).isEqualTo(Duration.ofSeconds(15));
    }

    @Test
    void otherAiCallsKeepTheir30SecondLimit() {
        assertThat(defaults().timeout()).isEqualTo(Duration.ofSeconds(30));
    }
}
