package app.lector.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(
        @DefaultValue("") String secretKey,
        @DefaultValue("") String webhookSecret,
        @DefaultValue("http://localhost:3000") String siteUrl,
        @DefaultValue("") String apiBase) {

    public boolean enabled() {
        return !secretKey.isBlank();
    }

    public boolean testMode() {
        return secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
    }
}
