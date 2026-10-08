package app.lector.translation;

import java.net.URI;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.awscore.retry.AwsRetryStrategy;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.translate.TranslateClient;
import software.amazon.awssdk.services.translate.TranslateClientBuilder;

/**
 * Amazon Translate, the only way the app reaches it. Off (and never calling AWS) unless {@code app.translation.enabled}
 * is set. Credentials come from the SDK's default chain: the task's role on AWS. A failure or an answer slower than the
 * timeout is "no translation"; the caller tries again on a later lookup.
 */
@Component
public class TranslationClient {

    private static final Logger log = LoggerFactory.getLogger(TranslationClient.class);

    private final TranslateClient client;

    public TranslationClient(TranslationProperties settings) {
        if (!settings.enabled()) {
            this.client = null;
            return;
        }
        TranslateClientBuilder builder = TranslateClient.builder()
                .region(Region.of(settings.region()))
                .overrideConfiguration(c -> c.apiCallTimeout(settings.timeout())
                        .retryStrategy(AwsRetryStrategy.doNotRetry()));
        if (!settings.endpoint().isBlank()) {
            builder.endpointOverride(URI.create(settings.endpoint()));
        }
        this.client = builder.build();
    }

    public boolean enabled() {
        return client != null;
    }

    /** {@code text} translated from {@code source} into {@code target} (language codes), or empty on any failure. */
    public Optional<String> translate(String text, String source, String target) {
        if (client == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(client.translateText(r -> r.text(text).sourceLanguageCode(source)
                    .targetLanguageCode(target)).translatedText());
        } catch (SdkException e) {
            log.warn("Amazon Translate failed for {} -> {}: {}", source, target, e.getMessage());
            return Optional.empty();
        }
    }
}
