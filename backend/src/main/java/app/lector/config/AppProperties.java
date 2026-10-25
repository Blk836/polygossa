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
        @DefaultValue("true") boolean seedSamples,
        @DefaultValue("false") boolean devAutoLogin) {

    public record Jwt(String secret, @DefaultValue("7d") Duration ttl) {}

    public record Tokenizer(@DefaultValue("") String url, @DefaultValue("5s") Duration timeout) {}

    public record Storage(@DefaultValue("./data/uploads") String dir, @DefaultValue("50MB") String maxAudioSize,
                          @DefaultValue("") String s3Bucket, @DefaultValue("eu-west-1") String s3Region,
                          @DefaultValue("") String s3Endpoint) {}

    public record OpenAi(
            @DefaultValue("") String apiKey,
            @DefaultValue("https://api.openai.com/v1") String baseUrl,
            @DefaultValue("gpt-4o-mini") String model,
            @DefaultValue("30s") Duration timeout,
            @DefaultValue("30") int dailyLimit,
            @DefaultValue("text-embedding-3-small") String embeddingModel,
            @DefaultValue("5s") Duration meaningTimeout,
            @DefaultValue("gpt-4.1-mini") String meaningModel,
            @DefaultValue("500000") long systemDailyTokens,
            @DefaultValue("gpt-4.1") String notWordsModel) {

        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record Billing(
            @DefaultValue("true") boolean enforceLimits,
            @DefaultValue("5") int freeTextLimit,
            @DefaultValue("500") int freeWordLimit) {}
}
