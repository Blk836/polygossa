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

    /**
     * Where uploads are kept: the local folder {@code dir}, or the S3 bucket {@code s3Bucket} when one is set
     * (production). {@code s3Endpoint} points the client elsewhere (tests' fake S3); blank means AWS itself.
     */
    public record Storage(@DefaultValue("./data/uploads") String dir, @DefaultValue("50MB") String maxAudioSize,
                          @DefaultValue("") String s3Bucket, @DefaultValue("eu-west-1") String s3Region,
                          @DefaultValue("") String s3Endpoint) {}

    /** OpenAI-compatible chat completions endpoint used for AI definitions, examples and the writing tutor. */
    public record OpenAi(
            @DefaultValue("") String apiKey,
            @DefaultValue("https://api.openai.com/v1") String baseUrl,
            @DefaultValue("gpt-4o-mini") String model,
            @DefaultValue("30s") Duration timeout,
            /* AI calls each user may make per day (their local day); protects the AI budget. */
            @DefaultValue("30") int dailyLimit,
            /* Model for /embeddings (Explore recommendations). */
            @DefaultValue("text-embedding-3-small") String embeddingModel) {

        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record Billing(
            @DefaultValue("true") boolean enforceLimits,
            @DefaultValue("5") int freeTextLimit,
            @DefaultValue("500") int freeWordLimit) {}
}
