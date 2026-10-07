package app.lector.dictionary;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/** native-language.feature: translations into the learner's language, through English Wiktionary's tables. */
class NativeGlossesTest {

    /** "dog": the animal sense leads back to German "Hund"; the verb sense to "jagen". */
    private static final String DOG = """
            {"word":"dog","entries":[
              {"language":{"code":"en"},"partOfSpeech":"noun","senses":[
                {"definition":"A mammal.","translations":[
                  {"language":{"code":"de"},"word":"Hund"},{"language":{"code":"es"},"word":"perro"},
                  {"language":{"code":"es"},"word":"can"},{"language":{"code":"zh"},"word":"гу"},
                  {"language":{"code":"zh"},"word":"狗"},{"language":{"code":"es"},"word":"perro"}]}]},
              {"language":{"code":"en"},"partOfSpeech":"verb","senses":[
                {"definition":"To pursue.","translations":[
                  {"language":{"code":"de"},"word":"jagen"},{"language":{"code":"es"},"word":"perseguir"}]}]}
            ]}""";

    private static final String HUND = """
            {"entries":[{"language":{"code":"de"},"partOfSpeech":"noun","senses":[
              {"definition":"dog (animal)"},{"definition":"a contemptible person; scoundrel"}]}]}""";

    private static final List<String> REQUESTS = new CopyOnWriteArrayList<>();
    private static HttpServer server;
    private static DictionaryClient client;
    private static NativeGlosses glosses;

    @BeforeAll
    static void start() throws IOException {
        Map<String, String> routes = Map.of("/fd/entries/en/dog", DOG, "/fd/entries/de/Hund", HUND,
                "/fd/entries/en/broken", "{not json");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = URLDecoder.decode(exchange.getRequestURI().getRawPath(), StandardCharsets.UTF_8);
            String query = exchange.getRequestURI().getQuery();
            REQUESTS.add(path + (query == null ? "" : "?" + query));
            String body = routes.get(path);
            byte[] bytes = (body == null ? "{}" : body).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(body == null ? 404 : 200, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        var props = new AppProperties(null, null, null,
                new AppProperties.Dictionary(base + "/fd", base + "/wk", Duration.ofSeconds(5)),
                null, null, List.of(), false, false);
        client = new DictionaryClient(props, RestClient.builder());
        glosses = new NativeGlosses(client);
    }

    @AfterAll
    static void stop() {
        server.stop(0);
    }

    @BeforeEach
    void clear() {
        REQUESTS.clear();
    }

    private static DictionaryResult found(Language language, String term, String... definitions) {
        return new DictionaryResult(term, language.code(), true, null,
                Arrays.stream(definitions).map(d -> new DictionaryResult.Sense("noun", d, List.of())).toList(),
                null, "Free Dictionary API (Wiktionary)", null);
    }

    @Test
    void aGermanWordForASpanishSpeakerGoesThroughTheEnglishGloss() {
        DictionaryResult r = glosses.add(client.lookup(Language.DE, "Hund"), Language.DE, NativeLanguage.ES);
        assertThat(r.translations()).containsExactly("perro", "can");
        assertThat(r.translationLanguage()).isEqualTo("es");
        assertThat(r.senses()).extracting(DictionaryResult.Sense::definition).first().isEqualTo("dog (animal)");
        assertThat(REQUESTS).contains("/fd/entries/en/dog?translations=true");
    }

    @Test
    void onlySensesThatLeadBackToTheWordCount() {
        DictionaryResult r = glosses.add(found(Language.DE, "Hund", "dog"), Language.DE, NativeLanguage.ES);
        assertThat(r.translations()).doesNotContain("perseguir");
        DictionaryResult jagen = glosses.add(found(Language.DE, "jagen", "to dog; to hunt"), Language.DE,
                NativeLanguage.ES);
        assertThat(jagen.translations()).containsExactly("perseguir");
    }

    @Test
    void theLemmaAlsoLeadsBack() {
        DictionaryResult hunde = new DictionaryResult("Hunde", "de", true, null,
                List.of(new DictionaryResult.Sense("noun", "plural of Hund", List.of()),
                        new DictionaryResult.Sense("noun", "dogs", List.of()),
                        new DictionaryResult.Sense("noun", "dog", List.of())), "Hund", "x", null);
        assertThat(glosses.add(hunde, Language.DE, NativeLanguage.ES).translations()).containsExactly("perro", "can");
    }

    @Test
    void learningEnglishUsesTheEntryItself() {
        DictionaryResult r = glosses.add(found(Language.EN, "dog", "A mammal."), Language.EN, NativeLanguage.ES);
        assertThat(r.translations()).containsExactly("perro", "can", "perseguir");
    }

    @Test
    void translationsInTheWrongScriptAreDropped() {
        DictionaryResult r = glosses.add(found(Language.DE, "Hund", "dog"), Language.DE, NativeLanguage.ZH);
        assertThat(r.translations()).containsExactly("狗");
    }

    @Test
    void noTranslationFoundLeavesAnEmptyList() {
        DictionaryResult r = glosses.add(found(Language.DE, "Katze", "a fierce person"), Language.DE,
                NativeLanguage.ES);
        assertThat(r.translations()).isEmpty();
        assertThat(r.translationLanguage()).isEqualTo("es");
        assertThat(r.senses()).hasSize(1);
    }

    @Test
    void englishSpeakersAndReadersOfTheirOwnLanguageGetNoTranslationLookup() {
        DictionaryResult en = glosses.add(found(Language.DE, "Hund", "dog"), Language.DE, NativeLanguage.EN);
        DictionaryResult same = glosses.add(found(Language.ES, "perro", "dog"), Language.ES, NativeLanguage.ES);
        assertThat(en.translations()).isNull();
        assertThat(en.translationLanguage()).isNull();
        assertThat(same.translations()).isNull();
        DictionaryResult missing = glosses.add(DictionaryResult.notFound("zz", "de"), Language.DE, NativeLanguage.ES);
        assertThat(missing.translations()).isNull();
        assertThat(REQUESTS).isEmpty();
    }

    @Test
    void aFailingSourceLeavesTheDefinitions() {
        DictionaryResult r = glosses.add(found(Language.DE, "kaputt", "broken"), Language.DE, NativeLanguage.ES);
        assertThat(r.found()).isTrue();
        assertThat(r.senses()).hasSize(1);
        assertThat(r.translations()).isEmpty();
    }

    @Test
    void picksShortGlossesAsPivots() {
        assertThat(NativeGlosses.pivots(List.of("dog (animal)", "to hunt; to chase", "a cat, a feline",
                "the act of running very fast across a long field", "plural of Hund", "dog", "")))
                .containsExactly("dog", "hunt", "cat");
    }
}
