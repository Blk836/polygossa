package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=map-word-meanings-no-ai",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.openai.api-key=",
        "app.translation.enabled=true",
        "app.translation.region=eu-west-1",
        "app.translation.timeout=1s"
})
@AutoConfigureMockMvc
class MapWordMeaningWithoutAiTest {

    private static final AtomicInteger HITS = new AtomicInteger();
    private static final HttpServer ANY_SERVICE;

    static {
        try {
            ANY_SERVICE = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            ANY_SERVICE.createContext("/", exchange -> {
                HITS.incrementAndGet();
                exchange.sendResponseHeaders(500, -1);
                exchange.close();
            });
            ANY_SERVICE.start();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        System.setProperty("aws.accessKeyId", "test");
        System.setProperty("aws.secretAccessKey", "test");
    }

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.openai.base-url", MapWordMeaningWithoutAiTest::anyService);
        registry.add("app.translation.endpoint", MapWordMeaningWithoutAiTest::anyService);
    }

    private static String anyService() {
        return "http://127.0.0.1:" + ANY_SERVICE.getAddress().getPort();
    }

    @AfterAll
    static void stop() {
        ANY_SERVICE.stop(0);
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
        HITS.set(0);
    }

    private static String fresh() {
        StringBuilder s = new StringBuilder("w");
        for (int i = 0; i < 9; i++) {
            s.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        }
        return s.toString();
    }

    private String learner() throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"pl\"}", 200);
        return token;
    }

    private JsonNode lookup(String term, boolean bare) throws Exception {
        return api.send(get("/api/dictionary").param("language", "fr").param("term", term)
                .param("bare", String.valueOf(bare)), learner(), 200);
    }

    private static List<String> meanings(JsonNode result) {
        return result.path("meanings").valueStream().map(JsonNode::asString).toList();
    }

    @Test
    void withoutTheAiTheMapFindsNoMeaningAndAsksNoOtherService() throws Exception {
        JsonNode result = lookup(fresh(), true);
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("source").isNull()).isTrue();
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("pl");
        assertThat(HITS.get()).isZero();
    }

    @Test
    void withoutTheAiTheMapStillShowsSharedMeanings() throws Exception {
        String word = fresh();
        for (int i = 0; i < 2; i++) {
            api.post(learner(), "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + word
                    + "\",\"meaning\":\"jabłko\"}", 201);
        }
        assertThat(meanings(lookup(word, true))).containsExactly("jabłko");
        assertThat(meanings(lookup(word, false))).containsExactly("jabłko");
        assertThat(HITS.get()).isZero();
    }
}
