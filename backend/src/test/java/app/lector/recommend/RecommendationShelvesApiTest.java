package app.lector.recommend;

import static app.lector.recommend.RecommendFixture.ids;
import static app.lector.recommend.RecommendFixture.reasonOf;
import static app.lector.recommend.RecommendFixture.shelf;
import static app.lector.recommend.RecommendFixture.shelfIds;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.writing.MutableClock;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=recshelves",
        "app.seed-samples=false"
})
@AutoConfigureMockMvc
class RecommendationShelvesApiTest {

    static final MutableClock CLOCK = new MutableClock();

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextFeatureJob job;

    @Autowired
    app.lector.text.TextFeatureRepository features;

    TestApi api;
    RecommendFixture fx;
    String learner;
    String author;
    String author2;
    Instant now;

    @org.junit.jupiter.api.AfterEach
    void deleteTexts() throws Exception {
        fx.cleanUp();
    }

    @BeforeEach
    void setUp() throws Exception {
        now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        CLOCK.set(now);
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        learner = api.signupPro();
        author = api.signupPro();
        author2 = api.signupPro();
        fx.learnWords(learner);
    }

    private int progress(long text, int position) throws Exception {
        return api.post(learner, "/api/texts/" + text + "/progress", "{\"position\":" + position + "}", 200)
                .get("percent").asInt();
    }

    @Test
    void continueReadingListsStartedTextsMostRecentFirst() throws Exception {
        long a = fx.publicText(author, "A", "food");
        long b = fx.publicText(author, "B", "news");
        long c = fx.publicText(author, "C", "travel");
        CLOCK.set(now.minus(Duration.ofDays(1)));
        int aPercent = progress(a, 20);
        CLOCK.set(now.minus(Duration.ofHours(1)));
        int bPercent = progress(b, 10);
        api.post(learner, "/api/texts/" + c + "/complete", "", 200);
        CLOCK.set(now);

        JsonNode shelf = shelf(fx.recommendations(learner), "continue");
        assertThat(ids(shelf)).containsExactly(b, a);
        assertThat(reasonOf(shelf, a).get("kind").asString()).isEqualTo("progress");
        assertThat(reasonOf(shelf, a).get("percent").asInt()).isEqualTo(aPercent).isPositive();
        assertThat(reasonOf(shelf, b).get("percent").asInt()).isEqualTo(bPercent);
    }

    @Test
    void abandonedTextsDropOut() throws Exception {
        long a = fx.publicText(author, "A", "food");
        long other = fx.publicText(author, "Other", "food");
        progress(a, 0);
        CLOCK.set(now.plus(Duration.ofDays(7)));
        JsonNode recs = fx.recommendations(learner);
        assertThat(ids(shelf(recs, "continue"))).doesNotContain(a);
        assertThat(ids(shelf(recs, "for-you"))).contains(other).doesNotContain(a);
    }

    @Test
    void myOwnTextsCanBeContinuedButAreNeverRecommended() throws Exception {
        long mine = fx.text(learner, "Mine", "food", 19, 1, false);
        long minePublic = fx.text(learner, "Mine shared", "food", 19, 1, true);
        progress(mine, 10);
        JsonNode recs = fx.recommendations(learner);
        assertThat(ids(shelf(recs, "continue"))).containsExactly(mine);
        for (String id : List.of("for-you", "just-right", "stretch", "topic")) {
            assertThat(ids(shelf(recs, id))).doesNotContain(mine, minePublic);
        }
    }

    @Test
    void onlyUnstartedPublicItemsInMyLanguageByOthersAreRecommended() throws Exception {
        long fresh = fx.publicText(author, "Fresh", "food");
        long privateOne = fx.text(author, "Private", "food", 19, 1, false);
        long spanish = fx.text(author, "Hola", "es", "food", RecommendFixture.content(19, 1), true);
        long finished = fx.publicText(author, "Finished", "food");
        long started = fx.publicText(author, "Started", "food");
        api.post(learner, "/api/texts/" + finished + "/complete", "", 200);
        progress(started, 20);
        List<Long> forYou = ids(shelf(fx.recommendations(learner), "for-you"));
        assertThat(forYou).contains(fresh).doesNotContain(privateOne, spanish, finished, started);
    }

    @Test
    void withoutALanguageEveryLanguageIsRecommended() throws Exception {
        long french = fx.publicText(author, "Bonjour", "food");
        long spanish = fx.text(author, "Hola", "es", "food", RecommendFixture.content(19, 1), true);
        JsonNode recs = api.get(learner, "/api/recommendations", 200);
        assertThat(ids(shelf(recs, "for-you"))).contains(french, spanish);
    }

    @Test
    void shelvesComeInOrderAndOnlyWithItems() throws Exception {
        long liked = fx.publicText(author, "Liked", "food");
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        long started = fx.publicText(author, "Started", "news");
        progress(started, 20);
        fx.text(author, "Easy food", "food", 24, 1, true);
        fx.text(author, "Harder food", "food", 22, 3, true);
        JsonNode recs = fx.recommendations(learner);
        assertThat(shelfIds(recs)).containsExactly("continue", "for-you", "topic", "just-right", "stretch");
    }

    @Test
    void justRightHoldsNinetyToNinetyEightPercentKnown() throws Exception {
        long p96 = fx.text(author, "96", "food", 24, 1, true);
        long p90 = fx.text(author, "90", "news", 18, 2, true);
        long p88 = fx.text(author, "88", "food", 22, 3, true);
        long p100 = fx.text(author, "100", "food", 20, 0, true);
        JsonNode shelf = shelf(fx.recommendations(learner), "just-right");
        assertThat(ids(shelf)).containsExactly(p96, p90).doesNotContain(p88, p100);
        assertThat(reasonOf(shelf, p96).get("kind").asString()).isEqualTo("known");
        assertThat(reasonOf(shelf, p96).get("percent").asDouble()).isEqualTo(96.0);
    }

    @Test
    void stretchHoldsEightyFiveToNinetyPercentKnownInMyTopics() throws Exception {
        long food88 = fx.text(author, "Food 88", "food", 22, 3, true);
        long news85 = fx.text(author, "News 85", "news", 17, 3, true);
        long food84 = fx.text(author, "Food 84", "food", 21, 4, true);
        JsonNode stretch = shelf(fx.recommendations(learner), "stretch");
        assertThat(ids(stretch)).containsExactlyInAnyOrder(food88, news85).doesNotContain(food84);
        assertThat(reasonOf(stretch, food88).get("percent").asDouble()).isEqualTo(88.0);

        long liked = fx.publicText(author, "Liked food", "food");
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        assertThat(ids(shelf(fx.recommendations(learner), "stretch"))).containsExactly(food88);
    }

    @Test
    void myStrongestCategoryGetsAShelfWhenThereAreNoTopicTags() throws Exception {
        long liked = fx.publicText(author, "Liked", "food");
        api.put(learner, "/api/library/" + liked + "/like", "", 204);
        long food = fx.publicText(author, "More food", "food");
        long news = fx.publicText(author, "News", "news");
        JsonNode topic = shelf(fx.recommendations(learner), "topic");
        assertThat(topic.get("category").asString()).isEqualTo("food");
        assertThat(topic.has("topic")).isFalse();
        assertThat(ids(topic)).containsExactlyInAnyOrder(liked, food).doesNotContain(news);
        assertThat(reasonOf(topic, food).get("kind").asString()).isEqualTo("category");
        assertThat(reasonOf(topic, food).get("category").asString()).isEqualTo("food");
    }

    @Test
    void forYouNeverShowsThreeInARowFromOneCategoryOrCreator() throws Exception {
        for (int i = 0; i < 5; i++) {
            fx.publicText(author, "Food " + i, "food");
        }
        fx.text(author2, "News", "news", 18, 2, true);
        fx.text(author2, "Travel", "travel", 18, 2, true);
        JsonNode forYou = shelf(fx.recommendations(learner), "for-you");
        List<JsonNode> items = new java.util.ArrayList<>();
        forYou.get("items").forEach(items::add);
        assertThat(items).hasSize(7);
        for (int i = 2; i < 5; i++) {
            JsonNode a = items.get(i - 2).get("text");
            JsonNode b = items.get(i - 1).get("text");
            JsonNode c = items.get(i).get("text");
            boolean sameCategory = a.get("category").equals(b.get("category")) && b.get("category").equals(c.get("category"));
            boolean sameOwner = a.get("owner").get("id").equals(b.get("owner").get("id"))
                    && b.get("owner").get("id").equals(c.get("owner").get("id"));
            assertThat(sameCategory || sameOwner).as("items %d–%d", i - 2, i).isFalse();
        }
    }

    @Test
    void everyCardHasAReason() throws Exception {
        fx.publicText(author, "One", "food");
        fx.text(author, "Two", "news", 10, 10, true);
        for (JsonNode shelf : fx.recommendations(learner).get("shelves")) {
            for (JsonNode item : shelf.get("items")) {
                assertThat(item.get("reason").get("kind").asString()).isNotBlank();
            }
        }
    }

    @Test
    void theSameDataGivesTheSameRanking() throws Exception {
        for (int i = 0; i < 6; i++) {
            fx.text(i % 2 == 0 ? author : author2, "T" + i, i % 3 == 0 ? "food" : "news", 15 + i, 2, true);
        }
        assertThat(fx.recommendations(learner)).isEqualTo(fx.recommendations(learner));
    }

    @Test
    void recommendationsAreFreeOnEveryPlan() throws Exception {
        String free = api.signup();
        fx.publicText(author, "Free", "food");
        assertThat(ids(shelf(api.get(free, "/api/recommendations?language=fr", 200), "for-you"))).isNotEmpty();
    }

    @Test
    void itemsShownOftenAndNeverOpenedSink() throws Exception {
        long x = fx.publicText(author, "X", "food");
        long y = fx.publicText(author2, "Y", "news");
        List<Long> before = ids(shelf(fx.recommendations(learner), "for-you"));
        long first = before.get(0);
        long second = first == x ? y : x;
        String event = "{\"type\":\"impression\",\"shelf\":\"for-you\",\"items\":[{\"textId\":" + first
                + ",\"position\":0}]}";
        for (int i = 0; i < 10; i++) {
            api.post(learner, "/api/recommendations/events", event, 204);
        }
        assertThat(ids(shelf(fx.recommendations(learner), "for-you"))).containsExactly(second, first);
    }

    @Test
    void anOpenKeepsAnItemFromSinking() throws Exception {
        long x = fx.publicText(author, "X", "food");
        long y = fx.publicText(author2, "Y", "news");
        List<Long> before = ids(shelf(fx.recommendations(learner), "for-you"));
        long first = before.get(0);
        for (int i = 0; i < 10; i++) {
            api.post(learner, "/api/recommendations/events", "{\"type\":\"impression\",\"shelf\":\"for-you\","
                    + "\"items\":[{\"textId\":" + first + ",\"position\":0}]}", 204);
        }
        api.post(learner, "/api/recommendations/events", "{\"type\":\"open\",\"shelf\":\"for-you\","
                + "\"items\":[{\"textId\":" + first + ",\"position\":0}]}", 204);
        assertThat(ids(shelf(fx.recommendations(learner), "for-you"))).containsExactly(first, first == x ? y : x);
    }

    @Test
    void aTextNoLongerSharedDropsOutOfContinueReading() throws Exception {
        long a = fx.publicText(author, "Soon private", "food");
        progress(a, 10);
        assertThat(ids(shelf(fx.recommendations(learner), "continue"))).containsExactly(a);
        api.patch(author, "/api/texts/" + a, "{\"isPublic\":false}", 200);
        assertThat(shelf(fx.recommendations(learner), "continue")).isNull();
    }

    @Test
    void continueReadingOnlyHoldsMyLanguage() throws Exception {
        long french = fx.publicText(author, "Bonjour", "food");
        long spanish = fx.text(author, "Hola", "es", "food", RecommendFixture.content(19, 1), true);
        progress(french, 10);
        progress(spanish, 10);
        assertThat(ids(shelf(fx.recommendations(learner), "continue"))).containsExactly(french);
        assertThat(ids(shelf(api.get(learner, "/api/recommendations", 200), "continue"))).contains(french, spanish);
    }

    @Autowired
    app.lector.session.ReadingSessionRepository sessions;

    @Autowired
    app.lector.user.UserRepository users;

    @Autowired
    app.lector.text.TextRepository texts;

    @Autowired
    org.springframework.transaction.support.TransactionTemplate tx;

    @Test
    void timeSpentReadingCountsTowardsItsCategory() throws Exception {
        long read = fx.text(author, "Read for long", "es", "travel", RecommendFixture.content(19, 1), true);
        long travel = fx.publicText(author, "Travel", "travel");
        long learnerId = api.get(learner, "/api/me", 200).get("id").asLong();
        tx.executeWithoutResult(s -> {
            var session = new app.lector.session.ReadingSession(users.findById(learnerId).orElseThrow(),
                    texts.findById(read).orElseThrow(), java.time.Instant.now());
            session.setDurationSeconds(1200);
            sessions.save(session);
        });
        JsonNode topic = shelf(fx.recommendations(learner), "topic");
        assertThat(topic.get("category").asString()).isEqualTo("travel");
        assertThat(ids(topic)).containsExactly(travel);
    }

    @Test
    void aNotInterestedAloneKeepsStretchToMyTopics() throws Exception {
        long dull = fx.publicText(author, "Dull news", "news");
        fx.text(author, "News 88", "news", 22, 3, true);
        assertThat(shelf(fx.recommendations(learner), "stretch")).isNotNull();
        api.put(learner, "/api/recommendations/not-interested/" + dull, "", 204);
        assertThat(shelf(fx.recommendations(learner), "stretch")).isNull();
    }

    @Test
    void withoutAnOpenAiKeyTheFeatureJobSendsNothing() throws Exception {
        fx.publicText(author, "Public", "food");
        assertThat(job.runOnce()).isZero();
        assertThat(features.count()).isZero();
    }
}
