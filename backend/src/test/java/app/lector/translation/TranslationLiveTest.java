package app.lector.translation;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.time.Duration;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.translate.TranslateClient;
import software.amazon.awssdk.services.translate.model.ListLanguagesResponse;

@Tag("live")
class TranslationLiveTest {

    private static final TranslationProperties SETTINGS =
            new TranslationProperties(true, "eu-west-1", "", Duration.ofSeconds(10), 1_333_333);

    private static Set<String> supported() {
        try (TranslateClient translate = TranslateClient.builder().region(Region.of(SETTINGS.region())).build()) {
            Set<String> codes = new java.util.HashSet<>();
            String next = null;
            do {
                String token = next;
                ListLanguagesResponse page = translate.listLanguages(r -> r.nextToken(token).maxResults(500));
                page.languages().forEach(l -> codes.add(l.languageCode()));
                next = page.nextToken();
            } while (next != null);
            return codes;
        }
    }

    @Test
    void everyLanguageCodeWeSendIsOneAmazonTranslateAccepts() {
        Set<String> ours = Arrays.stream(Language.values()).map(Language::code).collect(Collectors.toSet());
        Arrays.stream(NativeLanguage.values()).map(NativeLanguage::code).forEach(ours::add);
        assertThat(supported()).containsAll(ours);
    }

    @Test
    void aRealTranslationComesBackThroughOurClient() {
        TranslationClient client = new TranslationClient(SETTINGS);
        assertThat(client.translate("Hola, amigo", Language.ES.code(), NativeLanguage.EN.code(), () -> {}))
                .hasValueSatisfying(text -> assertThat(text.toLowerCase()).contains("friend"));
    }
}
