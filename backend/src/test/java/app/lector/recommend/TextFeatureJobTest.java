package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.common.JobLock;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import javax.sql.DataSource;
import app.lector.text.TextFeature;
import app.lector.text.TextFeatureRepository;
import app.lector.writing.MutableClock;
import app.lector.writing.OpenAiStub;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
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
        "test.database=featurejob",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.model=test-model",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0"
})
@AutoConfigureMockMvc
class TextFeatureJobTest {

    static final MutableClock CLOCK = new MutableClock();
    static final OpenAiStub AI = RecommendAi.start();
    static final String TAGS = "{\"appropriate\":true,\"topics\":[\"cooking\",\"spain\",\"tapas\"],"
            + "\"summary\":\"Tapas in Madrid.\",\"register\":\"casual\",\"suitableFor\":\"general\"}";

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
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

    @Autowired
    DataSource dataSource;

    TestApi api;
    RecommendFixture fx;
    String author;
    Instant now;

    @BeforeEach
    void setUp() throws Exception {
        now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        CLOCK.set(now);
        AI.reset();
        AI.reply(TAGS);
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        author = api.signupPro();
        job.runOnce();
        AI.reset();
        AI.reply(TAGS);
    }

    private List<String> taggingRequests() {
        return AI.requests().stream().filter(r -> r.contains("suitableFor")).toList();
    }

    private TextFeature feature(long textId) {
        return features.findByTextId(textId).orElseThrow();
    }

    @Test
    void aPublicTextGetsTagsASummaryAndAnEmbedding() throws Exception {
        long id = fx.text(author, "Tapas en Madrid", "fr", "food", "On mange des tapas a Madrid.", true);
        assertThat(job.runOnce()).isEqualTo(1);

        assertThat(taggingRequests()).hasSize(1);
        assertThat(taggingRequests().getFirst()).contains("<text>").contains("On mange des tapas").contains("</text>")
                .contains("Tapas en Madrid");
        assertThat(AI.embeddingRequests()).hasSize(1);
        assertThat(AI.embeddingRequests().getFirst()).contains("text-embedding-3-small").contains("Tapas en Madrid")
                .contains("Tapas in Madrid.").contains("On mange des tapas");

        TextFeature f = feature(id);
        assertThat(f.getTopics()).containsExactly("cooking", "spain", "tapas");
        assertThat(f.getSummary()).isEqualTo("Tapas in Madrid.");
        assertThat(f.getRegister()).isEqualTo("casual");
        assertThat(f.getSuitableFor()).isEqualTo("general");
        assertThat(f.vector()).containsExactly(1f, 0f, 0f);
        assertThat(f.getEmbeddingModel()).isEqualTo("text-embedding-3-small");
        assertThat(f.getTagModel()).isEqualTo("test-model");
        assertThat(f.getAttempts()).isZero();

        assertThat(job.runOnce()).isZero();
        assertThat(taggingRequests()).hasSize(1);
    }

    @Test
    void theScheduleDoesNothingWhileTheJobIsSwitchedOff() throws Exception {
        long id = fx.publicText(author, "Pas encore", "food");
        job.scheduled();
        assertThat(features.findByTextId(id)).isEmpty();
        job.runOnce();
        assertThat(features.findByTextId(id)).isPresent();
    }

    @Test
    void whileAnotherServerRunsTheJobThisOneSkipsWithoutAskingTheAi() throws Exception {
        long id = fx.publicText(author, "Deux serveurs", "food");
        AI.reset();
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        try (Connection other = DriverManager.getConnection(pool.getJdbcUrl(), pool.getUsername(), pool.getPassword());
             PreparedStatement hold = other.prepareStatement("select pg_advisory_lock(?)")) {
            hold.setLong(1, JobLock.key(TextFeatureJob.LOCK));
            hold.execute();
            assertThat(job.runAlone()).isEmpty();
            assertThat(AI.requests()).isEmpty();
            assertThat(features.findByTextId(id)).isEmpty();
        }
        AI.reply(TAGS);
        assertThat(job.runAlone()).contains(1);
        assertThat(features.findByTextId(id)).isPresent();
    }

    @Test
    void theBacklogIsTakenTwentyAtATime() throws Exception {
        for (int i = 0; i < 25; i++) {
            fx.publicText(author, "T" + i, "food");
        }
        assertThat(job.runOnce()).isEqualTo(20);
        assertThat(job.runOnce()).isEqualTo(5);
        assertThat(job.runOnce()).isZero();
    }

    @Test
    void privateTextsAreNeverSent() throws Exception {
        long id = fx.text(author, "Journal intime", "fr", "daily-life", "Mon secret.", false);
        AI.reset();
        assertThat(job.runOnce()).isZero();
        assertThat(AI.requests()).isEmpty();
        assertThat(AI.embeddingRequests()).isEmpty();
        assertThat(features.findByTextId(id)).isEmpty();
    }

    @Test
    void aiRepliesAreValidated() throws Exception {
        long id = fx.publicText(author, "Bizarre", "food");
        AI.reply("{\"topics\":[1, \"  Cooking \", \"cooking\", \"" + "x".repeat(41) + "\", \"\", \"a\", \"b\", \"c\","
                + " \"d\", \"e\", \"f\"], \"summary\":\"" + "s".repeat(400) + "\", \"register\":\"rant\","
                + " \"suitableFor\":\"adults\"}");
        job.runOnce();
        TextFeature f = feature(id);
        assertThat(f.getTopics()).containsExactly("cooking", "a", "b", "c", "d", "e");
        assertThat(f.getSummary()).hasSize(300);
        assertThat(f.getRegister()).isNull();
        assertThat(f.getSuitableFor()).isEqualTo("general");
    }

    @Test
    void aReplyWithoutTopicsStillGetsAnEmbedding() throws Exception {
        long id = fx.publicText(author, "Vide", "food");
        AI.reply("{\"topics\":\"cooking\"}");
        job.runOnce();
        assertThat(feature(id).getTopics()).isEmpty();
        assertThat(feature(id).vector()).isNotNull();
    }

    @Test
    void aFailedEmbeddingIsRetriedAfterABackOff() throws Exception {
        long id = fx.publicText(author, "Panne de vecteur", "food");
        AI.setEmbeddingsFailing(true);
        job.runOnce();
        assertThat(feature(id).vector()).isNull();
        assertThat(feature(id).getTopics()).containsExactly("cooking", "spain", "tapas");
        assertThat(feature(id).getAttempts()).isEqualTo(1);

        AI.setEmbeddingsFailing(false);
        job.runOnce();
        assertThat(feature(id).vector()).isNull();
        CLOCK.set(now.plus(Duration.ofMinutes(2)));
        job.runOnce();
        assertThat(feature(id).vector()).containsExactly(1f, 0f, 0f);
        assertThat(feature(id).getAttempts()).isZero();
        assertThat(taggingRequests().stream().filter(r -> r.contains("Panne de vecteur"))).hasSize(1);
    }

    @Test
    void theBackOffDoublesUpToADay() throws Exception {
        long id = fx.publicText(author, "Panne", "food");
        AI.setEmbeddingsFailing(true);
        Instant t = now;
        for (int attempt = 1; attempt <= 12; attempt++) {
            CLOCK.set(t);
            job.runOnce();
            Duration wait = Duration.ofMinutes(Math.min(1L << attempt, 24 * 60));
            assertThat(feature(id).getNextAttemptAt()).isEqualTo(t.plus(wait));
            t = t.plus(wait);
        }
    }

    @Test
    void failedTaggingIsRetriedToo() throws Exception {
        long id = fx.publicText(author, "Panne", "food");
        AI.setFailing(true);
        job.runOnce();
        assertThat(feature(id).getTagModel()).isNull();
        assertThat(feature(id).vector()).isNotNull();
        AI.setFailing(false);
        CLOCK.set(now.plus(Duration.ofMinutes(2)));
        job.runOnce();
        assertThat(feature(id).getTopics()).containsExactly("cooking", "spain", "tapas");
        assertThat(feature(id).getAttempts()).isZero();
    }

    @Test
    void anUnreadableEmbeddingCountsAsAFailure() throws Exception {
        long id = fx.publicText(author, "Panne", "food");
        AI.embeddingResponseRaw("{\"data\":[{\"embedding\":[\"x\"]}]}");
        job.runOnce();
        assertThat(feature(id).vector()).isNull();
        assertThat(feature(id).getAttempts()).isEqualTo(1);
        AI.embeddingResponseRaw("{\"data\":[]}");
        CLOCK.set(now.plus(Duration.ofMinutes(2)));
        job.runOnce();
        assertThat(feature(id).getAttempts()).isEqualTo(2);
    }

    @Test
    void anotherEmbeddingModelIsReEmbedded() throws Exception {
        long id = fx.publicText(author, "Ancien", "food");
        job.runOnce();
        features.save(feature(id).withEmbedding(new float[] {0, 1, 0}, "old-model"));
        assertThat(job.runOnce()).isEqualTo(1);
        assertThat(feature(id).getEmbeddingModel()).isEqualTo("text-embedding-3-small");
        assertThat(feature(id).vector()).containsExactly(1f, 0f, 0f);
    }

    @Test
    void deletingATextDeletesItsFeatures() throws Exception {
        long id = fx.publicText(author, "Bientot parti", "food");
        job.runOnce();
        api.delete(author, "/api/texts/" + id, 204);
        assertThat(features.findByTextId(id)).isEmpty();
    }
}
