package app.lector.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue Jwt jwt,
        @DefaultValue Tokenizer tokenizer,
        @DefaultValue Storage storage,
        @DefaultValue Dictionary dictionary,
        @DefaultValue OpenAi openai,
        @DefaultValue Billing billing,
        @DefaultValue("http://localhost:3000") List<String> corsOrigins,
        /* Seed starter texts for onboarding into the community library on first start. */
        @DefaultValue("true") boolean seedSamples,
        /* Development only: lets the frontend sign in to a shared test account without credentials. */
        @DefaultValue("false") boolean devAutoLogin) {

    public record Jwt(String secret, @DefaultValue("7d") Duration ttl) {}

    /** Base URL of the Python CJK tokenization sidecar; blank disables it (falls back to character segmentation). */
    public record Tokenizer(@DefaultValue("") String url, @DefaultValue("5s") Duration timeout) {}

    public record Storage(@DefaultValue("./data/uploads") String dir, @DefaultValue("50MB") String maxAudioSize) {}

    public record Dictionary(
            @DefaultValue("https://freedictionaryapi.com/api/v1") String freeDictionaryBaseUrl,
            @DefaultValue("https://en.wiktionary.org/api/rest_v1") String wiktionaryBaseUrl,
            @DefaultValue("5s") Duration timeout) {}

    /** OpenAI-compatible chat completions endpoint used for AI definitions, examples and the writing tutor. */
    public record OpenAi(
            @DefaultValue("") String apiKey,
            @DefaultValue("https://api.openai.com/v1") String baseUrl,
            @DefaultValue("gpt-4o-mini") String model,
            @DefaultValue("30s") Duration timeout) {

        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record Billing(
            @DefaultValue("true") boolean enforceLimits,
            @DefaultValue("5") int freeTextLimit,
            @DefaultValue("500") int freeWordLimit) {}
}
