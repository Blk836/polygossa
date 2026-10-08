package app.lector.translation;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Machine translation of single words through Amazon Translate (word-translations.feature): off unless
 * {@code enabled}, so development and tests never call AWS. {@code endpoint} points the client elsewhere (tests'
 * stub); blank means AWS itself. The cap is in characters a month: Amazon charges $15 a million, so the default is
 * $20 a month.
 */
@ConfigurationProperties(prefix = "app.translation")
public record TranslationProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("eu-west-1") String region,
        @DefaultValue("") String endpoint,
        @DefaultValue("3s") Duration timeout,
        @DefaultValue("1333333") long monthlyCharacterCap) {}
