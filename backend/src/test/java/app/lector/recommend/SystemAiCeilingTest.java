package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.ai.AiClient;
import app.lector.text.NotWords;
import app.lector.text.TextFeatureRepository;
import app.lector.text.WordVerdicts;
import app.lector.writing.MutableClock;
import app.lector.writing.OpenAiStub;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=system-ai-ceiling",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0",
        "app.openai.system-daily-tokens=1000"
})
@AutoConfigureMockMvc
class SystemAiCeilingTest {

    static final MutableClock CLOCK = new MutableClock();
    static final OpenAiStub AI = RecommendAi.start();
    static final AtomicInteger DAYS = new AtomicInteger();

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }

        @Bean
        @Primary
        NotWords importsLeaveTheCeilingToTagging(AiClient ai, WordVerdicts verdicts, ObjectMapper json) {
            return new NotWords(ai, verdicts, json) {
                @Override
                public boolean canCall() {
                    return false;
                }
            };
        }
    }

    @DynamicPropertySource
    static void ai(DynamicPropertyRegistry registry) {
        registry.add("app.openai.base-url", AI::baseUrl);
    }

    @AfterAll
    static void stop() {
        AI.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextFeatureJob job;

    @Autowired
    TextFeatureRepository features;

    RecommendFixture fx;
    String author;

    @BeforeEach
    void setUp() throws Exception {
        CLOCK.set(LocalDate.of(2031, 1, 1).plusDays(10L * DAYS.getAndIncrement()).atTime(9, 0)
                .toInstant(ZoneOffset.UTC));
        AI.reset();
        AI.reply(TextFeatureJobTest.TAGS);
        TestApi api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        author = api.signupPro();
        while (job.runOnce() > 0) {
            CLOCK.advance(Duration.ofSeconds(1));
        }
        AI.reset();
        AI.reply(TextFeatureJobTest.TAGS);
    }

    private List<String> taggingRequests() {
        return AI.requests().stream().filter(r -> r.contains("suitableFor")).toList();
    }

    private boolean tagged(long id) {
        return features.findByTextId(id).map(f -> f.getTagModel() != null).orElse(false);
    }

    @Test
    void underTheCeilingTaggingRunsAsUsual() throws Exception {
        AI.usage(500, 499);
        long first = fx.publicText(author, "Premier", "food");
        job.runOnce();
        long second = fx.publicText(author, "Second", "food");
        job.runOnce();
        assertThat(tagged(first)).isTrue();
        assertThat(tagged(second)).isTrue();
    }

    @Test
    void overTheCeilingNothingIsSentAndTheTextsAreNotMarkedFailed() throws Exception {
        AI.usage(600, 400);
        long first = fx.publicText(author, "Premier", "food");
        job.runOnce();
        assertThat(tagged(first)).isTrue();

        long waiting = fx.publicText(author, "En attente", "food");
        AI.reset();
        AI.reply(TextFeatureJobTest.TAGS);
        assertThat(job.runOnce()).isZero();
        assertThat(AI.requests()).isEmpty();
        assertThat(AI.embeddingRequests()).isEmpty();
        assertThat(features.findByTextId(waiting)).isEmpty();
    }

    @Test
    void reachingTheCeilingPartWayStopsTheRestOfTheBatchUntilTheNextDay() throws Exception {
        AI.usage(600, 400);
        long a = fx.publicText(author, "Un", "food");
        long b = fx.publicText(author, "Deux", "food");
        long c = fx.publicText(author, "Trois", "food");
        job.runOnce();
        assertThat(taggingRequests()).hasSize(1);
        job.runOnce();
        assertThat(taggingRequests()).hasSize(1);
        assertThat(List.of(a, b, c).stream().filter(this::tagged)).hasSize(1);
        assertThat(List.of(a, b, c).stream().filter(id -> features.findByTextId(id).isEmpty())).hasSize(2);

        CLOCK.advance(Duration.ofDays(1));
        AI.usage(10, 10);
        job.runOnce();
        assertThat(List.of(a, b, c).stream().filter(this::tagged)).hasSize(3);
        assertThat(features.findByTextId(a).orElseThrow().getAttempts()).isZero();
    }
}
