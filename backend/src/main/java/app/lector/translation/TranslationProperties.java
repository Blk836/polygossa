package app.lector.translation;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.translation")
public record TranslationProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("eu-west-1") String region,
        @DefaultValue("") String endpoint,
        @DefaultValue("3s") Duration timeout,
        @DefaultValue("1333333") long monthlyCharacterCap) {}
