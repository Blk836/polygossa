package app.lector.recommend;

import static app.lector.recommend.RecommendFixture.ids;
import static app.lector.recommend.RecommendFixture.reasonOf;
import static app.lector.recommend.RecommendFixture.shelf;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.text.TextFeatureRepository;
import app.lector.writing.OpenAiStub;
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

/**
 * Feature: Explore recommendations with AI features: "Because you read", topic shelves from tags, taste vectors,
 * interests and the topic filter (docs/acceptance/explore-recommendations.feature).
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:recai;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s"
})
@AutoConfigureMockMvc
class RecommendationAiShelvesApiTest {

    static final OpenAiStub AI = RecommendAi.start();

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

    TestApi api;
    RecommendFixture fx;
    String learner;
    String author;
    String author2;
    @org.junit.jupiter.api.AfterEach
    void deleteTexts() throws Exception {
        fx.cleanUp();
    }

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        AI.reply(tags("other"));
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        learner = api.signupPro();
        author = api.signupPro();
        author2 = api.signupPro();
        fx.learnWords(learner);
    }

    /** A chat reply that passes moderation and tags the text with these topics. */
    private static String tags(String... topics) {
        return "{\"appropriate\":true,\"topics\":[\"" + String.join("\",\"", topics) + "\"],\"summary\":\"S.\"}";
    }

    /** A public 95%-known text by {@code owner}, tagged and embedded as given once the job runs. */
    private long text(String owner, String title, String category, float[] vector, String... topics) throws Exception {
        AI.replyWhen(title, tags(topics));
        AI.embedWhen(title, vector);
        return fx.publicText(owner, title, category);
    }

    private void runJob() {
        while (job.runOnce() > 0) {
            // until the queue is empty
        }
    }

    @Test
    void becauseYouLikedListsTheNearestItems() throws Exception {
        long anchor = text(author, "Anchor tapas", "food", new float[] {1, 0, 0}, "cooking");
        long near = text(author, "Near paella", "food", new float[] {0.9f, 0.1f, 0}, "cooking");
        long nearer = text(author2, "Nearer tortilla", "food", new float[] {1, 0.01f, 0}, "cooking");
        long far = text(author2, "Far politics", "news", new float[] {0, 0, 1}, "politics");
        runJob();
        api.put(learner, "/api/library/" + anchor + "/like", "", 204);

        JsonNode because = shelf(fx.recommendations(learner), "because");
        assertThat(because.get("anchor").get("id").asLong()).isEqualTo(anchor);
        assertThat(because.get("anchor").get("title").asString()).isEqualTo("Anchor tapas");
        assertThat(because.get("anchor").get("liked").asBoolean()).isTrue();
        assertThat(ids(because)).containsExactly(nearer, near).doesNotContain(far, anchor);
        JsonNode reason = reasonOf(because, near);
        assertThat(reason.get("kind").asString()).isEqualTo("because");
        assertThat(reason.get("title").asString()).isEqualTo("Anchor tapas");
    }

    @Test
    void becauseYouReadUsesTheLatestFinishedText() throws Exception {
        long liked = text(author, "Old like", "food", new float[] {1, 0, 0}, "cooking");
        long read = text(author, "Just read", "news", new float[] {0, 0, 1}, "politics");
        long near = text(author2, "Near read", "news", new float[] {0, 0.1f, 1}, "politics");
        runJob();
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        Thread.sleep(5);
        api.post(learner, "/api/texts/" + read + "/complete", "", 200);
        JsonNode because = shelf(fx.recommendations(learner), "because");
        assertThat(because.get("anchor").get("id").asLong()).isEqualTo(read);
        assertThat(because.get("anchor").get("liked").asBoolean()).isFalse();
        assertThat(ids(because)).first().isEqualTo(near);
    }

    @Test
    void noBecauseShelfWithoutAnEmbeddingOfTheCurrentModel() throws Exception {
        long anchor = text(author, "Anchor", "food", new float[] {1, 0, 0}, "cooking");
        text(author, "Near", "food", new float[] {1, 0, 0}, "cooking");
        runJob();
        api.put(learner, "/api/library/" + anchor + "/like", "", 204);
        assertThat(shelf(fx.recommendations(learner), "because")).isNotNull();
        features.save(features.findByTextId(anchor).orElseThrow().withEmbedding(new float[] {1, 0, 0}, "old-model"));
        assertThat(shelf(fx.recommendations(learner), "because")).isNull();
    }

    @Test
    void theStrongestTopicTagGetsAShelf() throws Exception {
        long liked = text(author, "Liked cooking", "food", new float[] {1, 0, 0}, "cooking", "spain");
        long cooking = text(author2, "More cooking", "daily-life", new float[] {0, 1, 0}, "cooking");
        long football = text(author2, "Football", "entertainment", new float[] {0, 0, 1}, "football");
        runJob();
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        api.post(learner, "/api/texts/" + liked + "/complete", "", 200);
        JsonNode topic = shelf(fx.recommendations(learner), "topic");
        assertThat(topic.get("topic").asString()).isEqualTo("cooking");
        assertThat(ids(topic)).containsExactly(cooking).doesNotContain(football);
        assertThat(reasonOf(topic, cooking).get("kind").asString()).isEqualTo("topic");
        assertThat(reasonOf(topic, cooking).get("topic").asString()).isEqualTo("cooking");
    }

    @Test
    void forYouPrefersWhatIsLikeMyTaste() throws Exception {
        long liked = text(author, "Taste", "food", new float[] {1, 0, 0}, "x");
        long far = text(author, "Far news", "news", new float[] {0, 1, 0}, "y");
        long near = text(author2, "Near news", "news", new float[] {1, 0.1f, 0}, "z");
        runJob();
        api.post(learner, "/api/texts/" + liked + "/complete", "", 200);
        assertThat(ids(shelf(fx.recommendations(learner), "for-you"))).containsExactly(near, far);
    }

    @Test
    void interestsSeedTheTasteOfANewLearner() throws Exception {
        text(author, "Food item", "food", new float[] {1, 0, 0}, "cooking");
        long near = text(author2, "Near history", "history", new float[] {1, 0.1f, 0}, "kings");
        long far = text(author, "Far history", "history", new float[] {0, 0, 1}, "queens");
        runJob();
        api.put(learner, "/api/recommendations/interests", "{\"categories\":[\"food\"]}", 200);
        java.util.List<Long> forYou = ids(shelf(fx.recommendations(learner), "for-you"));
        assertThat(forYou.indexOf(near)).isLessThan(forYou.indexOf(far));
    }

    @Test
    void exploreCanBeFilteredByTopic() throws Exception {
        long tapas = text(author, "Tapas topic", "food", new float[] {1, 0, 0}, "cooking", "tapas");
        long other = text(author, "Other topic", "food", new float[] {1, 0, 0}, "cookingware");
        runJob();
        JsonNode page = api.get(learner, "/api/library?language=fr&topic=cooking", 200);
        java.util.List<Long> found = new java.util.ArrayList<>();
        page.get("items").forEach(i -> found.add(i.get("id").asLong()));
        assertThat(found).containsExactly(tapas).doesNotContain(other);
        assertThat(api.get(learner, "/api/library?language=fr&topic=COOKING&sort=popular", 200).get("items").size())
                .isEqualTo(1);
        api.get(learner, "/api/library?topic=cook%25", 400);
        api.get(learner, "/api/library?topic=" + "x".repeat(41), 400);
    }
}
