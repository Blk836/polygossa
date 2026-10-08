package app.lector.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Stripe (stripe-billing.feature). A secret key switches real billing on; blank (local runs, tests) keeps the plan
 * switch. {@code webhookSecret} checks webhook signatures; {@code siteUrl} is where Checkout and the portal return;
 * {@code apiBase} points the client elsewhere (tests' fake Stripe).
 */
@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(
        @DefaultValue("") String secretKey,
        @DefaultValue("") String webhookSecret,
        @DefaultValue("http://localhost:3000") String siteUrl,
        @DefaultValue("") String apiBase) {

    public boolean enabled() {
        return !secretKey.isBlank();
    }

    /** Test-mode keys take only Stripe's test cards. */
    public boolean testMode() {
        return secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
    }
}
