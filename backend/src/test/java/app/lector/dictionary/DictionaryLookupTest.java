package app.lector.dictionary;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.token.Language;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/** Runs DictionaryClient against a local stub of both dictionary APIs. */
class DictionaryLookupTest {

    private static final String CASA = """
            {"word":"casa","entries":[
              {"language":{"code":"en","name":"English"},"partOfSpeech":"noun","pronunciations":[],
               "senses":[{"definition":"ENGLISH SENSE MUST BE IGNORED","examples":[]}]},
              {"language":{"code":"es","name":"Spanish"},"partOfSpeech":"noun",
               "pronunciations":[{"type":"enPR","text":"kä'sä"},{"type":"ipa","text":"/ˈkasa/"},{"type":"ipa","text":"[x]"}],
               "senses":[{"definition":"house","examples":["Mi casa es tu casa.","Dos","Tres"],"subsenses":[]},
                         {"definition":"   ","examples":[]}]},
              {"language":{"code":"es","name":"Spanish"},"partOfSpeech":"verb","pronunciations":[{"type":"ipa","text":"/other/"}],
               "senses":[{"definition":"inflection of casar:","examples":[],
                          "subsenses":[{"definition":"third-person singular present indicative"}]}]}
            ]}""";

    private static final String MANY_SENSES = """
            {"entries":[{"language":{"code":"es"},"partOfSpeech":"noun","pronunciations":[],"senses":[
              {"definition":"s1"},{"definition":"s2"},{"definition":"s3"},{"definition":"s4"},{"definition":"s5"},
              {"definition":"s6"},{"definition":"s7"},{"definition":"s8"},{"definition":"s9"},{"definition":"s10"}]}]}""";

    private static final String ONLY_ENGLISH = """
            {"entries":[{"language":{"code":"en"},"partOfSpeech":"noun","senses":[{"definition":"dog"}]}]}""";

    private static final String WIKTIONARY_PERRO = """
            {"en":[{"partOfSpeech":"Noun","definitions":[{"definition":"WRONG LANGUAGE"}]}],
             "es":[{"partOfSpeech":"Noun","language":"Spanish","definitions":[
               {"definition":"<a href=\\"/wiki/dog\\">dog</a> (<i>animal</i>)","examples":["<b>perro</b> grande","b","c"]},
               {"definition":"<span></span>"}]},
              {"partOfSpeech":"Adjective","definitions":[{"definition":"plural of perra"}]}]}""";

    private static HttpServer server;
    private static DictionaryClient client;

    @BeforeAll
    static void start() throws IOException {
        Map<String, String> routes = Map.of(
                "/fd/entries/es/casa", CASA,
                "/fd/entries/es/muchos", MANY_SENSES,
                "/fd/entries/es/perro", ONLY_ENGLISH,
                "/wk/page/definition/perro", WIKTIONARY_PERRO);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.createContext("/slow", exchange -> {
            try {
                Thread.sleep(3000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        server.createContext("/", exchange -> {
            String path = URLDecoder.decode(exchange.getRequestURI().getRawPath(), StandardCharsets.UTF_8);
            String body = routes.get(path);
            byte[] bytes = (body == null ? "{\"title\":\"Not found\"}" : body).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
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
    }

    @AfterAll
    static void stop() {
        server.stop(0);
    }

    @Test
    void parsesFreeDictionaryEntriesForTheRequestedLanguageOnly() {
        DictionaryResult r = client.lookup(Language.ES, "casa");
        assertThat(r.found()).isTrue();
        assertThat(r.source()).isEqualTo("Free Dictionary API (Wiktionary)");
        assertThat(r.sourceUrl()).isEqualTo("https://en.wiktionary.org/wiki/casa");
        assertThat(r.senses()).extracting(DictionaryResult.Sense::definition)
                .containsExactly("house", "inflection of casar: third-person singular present indicative");
        assertThat(r.senses()).extracting(DictionaryResult.Sense::partOfSpeech).containsExactly("noun", "verb");
    }

    @Test
    void prefersTheFirstIpaPronunciation() {
        assertThat(client.lookup(Language.ES, "casa").pronunciation()).isEqualTo("/ˈkasa/");
    }

    @Test
    void keepsAtMostTwoExamplesPerSense() {
        assertThat(client.lookup(Language.ES, "casa").senses().getFirst().examples())
                .containsExactly("Mi casa es tu casa.", "Dos");
    }

    @Test
    void extractsTheLemmaFromFormOfSenses() {
        assertThat(client.lookup(Language.ES, "casa").lemma()).isEqualTo("casar");
    }

    @Test
    void capsSensesAtEight() {
        assertThat(client.lookup(Language.ES, "muchos").senses()).hasSize(8);
    }

    @Test
    void fallsBackToWiktionaryWhenTheFreeDictionaryHasNoEntryInTheLanguage() {
        DictionaryResult r = client.lookup(Language.ES, "perro");
        assertThat(r.found()).isTrue();
        assertThat(r.source()).isEqualTo("Wiktionary");
        assertThat(r.pronunciation()).isNull();
        assertThat(r.senses()).extracting(DictionaryResult.Sense::definition)
                .containsExactly("dog (animal)", "plural of perra");
        assertThat(r.senses().getFirst().partOfSpeech()).isEqualTo("noun");
        assertThat(r.senses().getFirst().examples()).containsExactly("perro grande", "b");
        assertThat(r.lemma()).isEqualTo("perra");
    }

    @Test
    void reportsNotFoundWhenNeitherSourceKnowsTheWord() {
        DictionaryResult r = client.lookup(Language.ES, "zzzz");
        assertThat(r.found()).isFalse();
        assertThat(r.senses()).isEmpty();
        assertThat(r.term()).isEqualTo("zzzz");
        assertThat(r.language()).isEqualTo("es");
    }

    @Test
    void slowDictionariesTimeOutAndCountAsNotFound() {
        String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/slow";
        var props = new AppProperties(null, null, null,
                new AppProperties.Dictionary(base, base, Duration.ofMillis(300)), null, null, List.of(), false, false);
        long started = System.nanoTime();
        DictionaryResult r = new DictionaryClient(props, RestClient.builder()).lookup(Language.ES, "lento");
        assertThat(r.found()).isFalse();
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofMillis(2500));
    }
}
