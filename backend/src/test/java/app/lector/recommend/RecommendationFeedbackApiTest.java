package app.lector.recommend;

import static app.lector.recommend.RecommendFixture.ids;
import static app.lector.recommend.RecommendFixture.shelf;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.recommend.RecommendationEvent.Type;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: Explore recommendations: "Not interested", interests and logged events
 * (docs/acceptance/explore-recommendations.feature).
 */
@org.springframework.boot.test.context.SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:recfeedback;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false"
})
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
class RecommendationFeedbackApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    RecommendationEventRepository events;

    @Autowired
    TextDismissalRepository dismissals;

    TestApi api;
    RecommendFixture fx;
    String learner;
    String author;

    @org.junit.jupiter.api.AfterEach
    void deleteTexts() throws Exception {
        fx.cleanUp();
    }

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        learner = api.signupPro();
        author = api.signupPro();
    }

    // ---- Not interested ----

    @Test
    void notInterestedRemovesAnItemFromEveryShelf() throws Exception {
        long dull = fx.publicText(author, "Dull", "news");
        long other = fx.publicText(author, "Other", "food");
        api.put(learner, "/api/recommendations/not-interested/" + dull, "", 204);
        JsonNode recs = fx.recommendations(learner);
        for (JsonNode shelf : recs.get("shelves")) {
            assertThat(ids(shelf)).doesNotContain(dull);
        }
        assertThat(ids(shelf(recs, "for-you"))).contains(other);
    }

    @Test
    void notInterestedCountsAgainstTheCategory() throws Exception {
        long dull = fx.publicText(author, "Dull", "news");
        long liked = fx.publicText(author, "Liked", "food");
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        long news = fx.publicText(author, "More news", "news");
        api.put(learner, "/api/recommendations/not-interested/" + dull, "", 204);
        // news now counts -4 (outside my topics), food +3: stretch-free data, so check the topic shelf and For you
        JsonNode recs = fx.recommendations(learner);
        assertThat(shelf(recs, "topic").get("category").asString()).isEqualTo("food");
        assertThat(ids(shelf(recs, "for-you"))).containsExactly(liked, news);
    }

    @Test
    void markingTwiceIsFineAndUndoBringsItBack() throws Exception {
        long dull = fx.publicText(author, "Dull", "news");
        api.put(learner, "/api/recommendations/not-interested/" + dull, "", 204);
        api.put(learner, "/api/recommendations/not-interested/" + dull, "", 204);
        api.delete(learner, "/api/recommendations/not-interested/" + dull, 204);
        api.delete(learner, "/api/recommendations/not-interested/" + dull, 204);
        assertThat(ids(shelf(fx.recommendations(learner), "for-you"))).contains(dull);
    }

    @Test
    void notInterestedInSomethingICantReadIs404() throws Exception {
        long secret = fx.text(author, "Secret", "news", 5, 5, false);
        api.put(learner, "/api/recommendations/not-interested/" + secret, "", 404);
        api.put(learner, "/api/recommendations/not-interested/999999", "", 404);
    }

    // ---- interests ----

    @Test
    void interestsCanBeSavedReadAndCleared() throws Exception {
        assertThat(api.get(learner, "/api/recommendations/interests", 200).get("categories")).isEmpty();
        JsonNode saved = api.put(learner, "/api/recommendations/interests",
                "{\"categories\":[\"travel\",\"food\",\"news\",\"food\"]}", 200);
        assertThat(saved.get("categories").toString()).isEqualTo("[\"news\",\"travel\",\"food\"]");
        assertThat(api.get(learner, "/api/recommendations/interests", 200)).isEqualTo(saved);
        api.put(learner, "/api/recommendations/interests", "{\"categories\":[]}", 200);
        assertThat(api.get(learner, "/api/recommendations/interests", 200).get("categories")).isEmpty();
    }

    @Test
    void unknownOrMissingInterestsAreRejected() throws Exception {
        api.put(learner, "/api/recommendations/interests", "{\"categories\":[\"cooking\"]}", 400);
        api.put(learner, "/api/recommendations/interests", "{}", 400);
    }

    @Test
    void interestsSeedTheTopicShelfForANewLearner() throws Exception {
        long food = fx.publicText(author, "Food", "food");
        fx.publicText(author, "News", "news");
        api.put(learner, "/api/recommendations/interests", "{\"categories\":[\"food\",\"travel\"]}", 200);
        JsonNode topic = shelf(fx.recommendations(learner), "topic");
        assertThat(topic.get("category").asString()).isEqualTo("food");
        assertThat(ids(topic)).containsExactly(food);
    }

    // ---- events ----

    @Test
    void impressionsAndOpensAreLoggedWithShelfAndPosition() throws Exception {
        long a = fx.publicText(author, "A", "news");
        long b = fx.publicText(author, "B", "food");
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"just-right\","
                + "\"items\":[{\"textId\":" + a + ",\"position\":0},{\"textId\":" + b + ",\"position\":1}]}", 204);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"open\",\"shelf\":\"just-right\","
                + "\"items\":[{\"textId\":" + b + ",\"position\":1}]}", 204);
        var logged = events.findAll().stream().filter(e -> e.getTextId() == a || e.getTextId() == b).toList();
        assertThat(logged).extracting(e -> e.getType() + ":" + e.getShelf() + ":" + e.getTextId() + ":" + e.getPosition())
                .containsExactlyInAnyOrder(Type.IMPRESSION + ":just-right:" + a + ":0",
                        Type.IMPRESSION + ":just-right:" + b + ":1", Type.OPEN + ":just-right:" + b + ":1");
    }

    @Test
    void eventsForTextsICantReadAreIgnored() throws Exception {
        long secret = fx.text(author, "Secret", "news", 5, 5, false);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\","
                + "\"items\":[{\"textId\":" + secret + ",\"position\":0},{\"textId\":999999,\"position\":1}]}", 204);
        assertThat(events.findAll()).noneMatch(e -> e.getTextId() == secret || e.getTextId() == 999999L);
    }

    @Test
    void invalidEventsAreRejected() throws Exception {
        long a = fx.publicText(author, "A", "news");
        String item = "{\"textId\":" + a + ",\"position\":0}";
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"popular\",\"items\":["
                + item + "]}", 400);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"hover\",\"shelf\":\"for-you\",\"items\":["
                + item + "]}", 400);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":[]}",
                400);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":[{\"textId\":"
                + a + ",\"position\":-1}]}", 400);
        String many = String.join(",", java.util.Collections.nCopies(101, item));
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":["
                + many + "]}", 400);
        String hundred = String.join(",", java.util.Collections.nCopies(100, item));
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":["
                + hundred + "]}", 204);
    }

    // ---- deleting a text ----

    @Test
    void deletingATextDeletesItsDismissalsAndEvents() throws Exception {
        long a = fx.publicText(author, "A", "news");
        api.put(learner, "/api/recommendations/not-interested/" + a, "", 204);
        api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\","
                + "\"items\":[{\"textId\":" + a + ",\"position\":0}]}", 204);
        api.delete(author, "/api/texts/" + a, 204);
        fx.forget(a);
        assertThat(events.findAll()).noneMatch(e -> e.getTextId() == a);
        assertThat(dismissals.findAll()).noneMatch(d -> d.getTextId() == a);
    }
}
