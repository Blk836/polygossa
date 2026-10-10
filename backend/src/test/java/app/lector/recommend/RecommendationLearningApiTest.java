package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import java.time.Instant;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=reclearning",
        "app.seed-samples=false",
        "app.recommend.learn.enabled=true"
})
@AutoConfigureMockMvc
class RecommendationLearningApiTest {

    static final String PARTS = "\"parts\":{\"interest\":0.1,\"topic\":0.2,\"comprehension\":0.9,\"level\":0.5,"
            + "\"popular\":0,\"fresh\":0.8,\"format\":0.4}";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    RecommendationEventRepository events;

    @Autowired
    WeightLearningJob job;

    private TestApi api;
    private RecommendFixture fx;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
    }

    @AfterEach
    void cleanUp() throws Exception {
        fx.cleanUp();
        events.deleteAll();
        job.runOnce();
    }

    private List<RecommendationEvent> logged() {
        return events.findAll(org.springframework.data.domain.Sort.by("id"));
    }

    @Test
    void rankedCardsCarryTheirScorePartsButContinueReadingDoesNot() throws Exception {
        String author = api.signupPro();
        String learner = api.signupPro();
        fx.learnWords(learner);
        long started = fx.publicText(author, "Started", "travel");
        fx.publicText(author, "Fresh one", "travel");
        fx.publicText(author, "Fresh two", "food");
        api.post(learner, "/api/texts/" + started + "/progress", "{\"position\":4}", 200);

        JsonNode recs = fx.recommendations(learner);
        boolean sawRanked = false;
        for (JsonNode shelf : recs.get("shelves")) {
            for (JsonNode item : shelf.get("items")) {
                if (shelf.get("id").asString().equals("continue")) {
                    assertThat(item.has("parts")).isFalse();
                } else {
                    sawRanked = true;
                    for (String part : List.of("interest", "topic", "comprehension", "level", "popular", "fresh",
                            "format")) {
                        assertThat(item.get("parts").has(part)).as(part).isTrue();
                    }
                }
            }
        }
        assertThat(sawRanked).isTrue();
        assertThat(RecommendFixture.shelf(recs, "continue")).isNotNull();
    }

    @Test
    void impressionsAreLoggedWithTheirPartsAndOpensNeverAre() throws Exception {
        String author = api.signupPro();
        String learner = api.signupPro();
        long text = fx.publicText(author, "Shown", "travel");
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":["
                + "{\"textId\":" + text + ",\"position\":0," + PARTS + "}]}", 204);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":["
                + "{\"textId\":" + text + ",\"position\":1}]}", 204);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"open\",\"shelf\":\"for-you\",\"items\":["
                + "{\"textId\":" + text + ",\"position\":0," + PARTS + "}]}", 204);

        List<RecommendationEvent> rows = logged();
        assertThat(rows).hasSize(3);
        RecommendationEvent withParts = rows.get(0);
        assertThat(withParts.parts()).containsExactly(0.1, 0.2, 0.9, 0.5, 0.0, 0.8, 0.4);
        assertThat(rows.get(1).parts()).isNull();
        assertThat(rows.get(2).getType()).isEqualTo(RecommendationEvent.Type.OPEN);
        assertThat(rows.get(2).parts()).isNull();
    }

    @Test
    void invalidScorePartsAreRejected() throws Exception {
        String author = api.signupPro();
        String learner = api.signupPro();
        long text = fx.publicText(author, "Shown", "travel");
        String good = "{\"textId\":" + text + ",\"position\":0," + PARTS + "}";
        for (String bad : List.of(
                "\"parts\":{\"interest\":0.1,\"topic\":0.2,\"comprehension\":0.9,\"level\":0.5,\"popular\":0,\"fresh\":0.8}",
                "\"parts\":{\"interest\":51,\"topic\":0.2,\"comprehension\":0.9,\"level\":0.5,\"popular\":0,\"fresh\":0.8,\"format\":0.4}",
                "\"parts\":{\"interest\":-1.5,\"topic\":0.2,\"comprehension\":0.9,\"level\":0.5,\"popular\":0,\"fresh\":0.8,\"format\":0.4}")) {
            api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":["
                    + good + ",{\"textId\":" + text + ",\"position\":1," + bad + "}]}", 400);
        }
        assertThat(logged()).isEmpty();
    }

    @Test
    void readingTheFit() throws Exception {
        String user = api.signup();
        JsonNode fit = api.get(user, "/api/recommendations/weights?days=28&outcome=open", 200);
        assertThat(fit.get("days").asInt()).isEqualTo(28);
        assertThat(fit.get("outcome").asString()).isEqualTo("open");
        assertThat(fit.get("examples").asInt()).isZero();
        assertThat(fit.get("positives").asInt()).isZero();
        assertThat(fit.get("configured").get("comprehend").asDouble()).isEqualTo(1.0);
        assertThat(fit.get("learned").isNull()).isTrue();
        assertThat(fit.get("using").asString()).isEqualTo("configured");
        for (String bad : List.of("days=0", "days=366", "outcome=liked")) {
            api.get(user, "/api/recommendations/weights?" + bad, 400);
        }
    }

    @Test
    void switchingRankingToLearnedWeightsAndBack() throws Exception {
        Random random = new Random(42);
        Instant now = Instant.now();
        for (int i = 0; i < 400; i++) {
            double comprehension = random.nextDouble();
            double[] parts = {random.nextDouble(), random.nextDouble(), comprehension, random.nextDouble(),
                    random.nextDouble(), random.nextDouble(), random.nextDouble()};
            long user = 1_000_000L + i / 10;
            long text = 2_000_000L + i;
            RecommendationEvent shown = new RecommendationEvent(user, text, ShelfId.FOR_YOU, i % 8,
                    RecommendationEvent.Type.IMPRESSION, now.minusSeconds(3600));
            shown.setParts(parts);
            events.save(shown);
            if (comprehension > 0.5) {
                events.save(new RecommendationEvent(user, text, ShelfId.FOR_YOU, i % 8, RecommendationEvent.Type.OPEN,
                        now.minusSeconds(1800)));
            }
        }
        job.runOnce();
        String user = api.signup();
        JsonNode fit = api.get(user, "/api/recommendations/weights", 200);
        assertThat(fit.get("examples").asInt()).isEqualTo(400);
        assertThat(fit.get("using").asString()).isEqualTo("learned");
        assertThat(fit.get("learned").get("comprehend").asDouble()).isPositive();

        events.deleteAll();
        job.runOnce();
        assertThat(api.get(user, "/api/recommendations/weights", 200).get("using").asString()).isEqualTo("configured");
    }
}
