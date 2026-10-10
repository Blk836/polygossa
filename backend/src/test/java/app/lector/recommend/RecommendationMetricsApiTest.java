package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import app.lector.TestApi;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=recmetrics",
        "app.seed-samples=false"
})
@AutoConfigureMockMvc
class RecommendationMetricsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private void log(TestApi api, String user, String type, String shelf, long text) throws Exception {
        api.post(user, "/api/recommendations/events", "{\"type\":\"" + type + "\",\"shelf\":\"" + shelf
                + "\",\"items\":[{\"textId\":" + text + ",\"position\":0}]}", 204);
    }

    private void know(TestApi api, String user, int words, String prefix) throws Exception {
        for (int i = 0; i < words; i++) {
            api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + prefix + RecommendFixture.letters(i)
                    + "\",\"status\":\"known\"}", 201);
        }
    }

    private static JsonNode shelf(JsonNode metrics, String id) {
        for (JsonNode s : metrics.get("shelves")) {
            if (s.get("shelf").asString().equals(id)) {
                return s;
            }
        }
        throw new AssertionError("no shelf " + id + " in " + metrics);
    }

    @Test
    void metricsPerShelfAndKnownWordGrowthByExploreUse() throws Exception {
        TestApi api = new TestApi(mvc, json);
        RecommendFixture fx = new RecommendFixture(api);
        String author = api.signupPro();
        List<Long> texts = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            texts.add(fx.publicText(author, "T" + i, "food"));
        }
        String reader = api.signupPro();
        for (int i = 0; i < 4; i++) {
            log(api, reader, "impression", "for-you", texts.get(i));
        }
        log(api, reader, "open", "for-you", texts.get(0));
        log(api, reader, "open", "for-you", texts.get(0));
        log(api, reader, "open", "for-you", texts.get(1));
        api.post(reader, "/api/texts/" + texts.get(0) + "/complete", "", 200);
        api.post(reader, "/api/texts/" + texts.get(1) + "/progress", "{\"position\":0}", 200);
        log(api, reader, "impression", "stretch", texts.get(5));

        JsonNode metrics = api.get(reader, "/api/recommendations/metrics?days=28", 200);
        assertThat(metrics.get("days").asInt()).isEqualTo(28);
        JsonNode forYou = shelf(metrics, "for-you");
        assertThat(forYou.get("impressions").asLong()).isEqualTo(4);
        assertThat(forYou.get("opens").asLong()).isEqualTo(3);
        assertThat(forYou.get("clickThrough").asDouble()).isCloseTo(0.75, within(1e-9));
        assertThat(forYou.get("opened").asLong()).isEqualTo(2);
        assertThat(forYou.get("readHalf").asDouble()).isCloseTo(0.5, within(1e-9));
        assertThat(forYou.get("finished").asDouble()).isCloseTo(0.5, within(1e-9));
        JsonNode stretch = shelf(metrics, "stretch");
        assertThat(stretch.get("impressions").asLong()).isEqualTo(1);
        assertThat(stretch.get("opens").asLong()).isZero();
        assertThat(stretch.get("clickThrough").asDouble()).isZero();
        assertThat(stretch.get("readHalf").isNull()).isTrue();

        assertThat(metrics.get("growth").get("heavy").isNull()).isTrue();
        assertThat(metrics.get("growth").get("light").isNull()).isTrue();

        for (int u = 0; u < 10; u++) {
            String user = api.signupPro();
            boolean heavy = u < 5;
            long session = api.post(user, "/api/sessions", "{\"textId\":" + texts.get(0) + "}", 201).get("id").asLong();
            api.post(user, "/api/sessions/" + session + "/heartbeat", "{\"seconds\":5}", 200);
            for (int i = 0; heavy && i < 5; i++) {
                log(api, user, "open", "for-you", texts.get(i));
            }
            know(api, user, heavy ? 8 : 4, "g");
        }
        JsonNode growth = api.get(reader, "/api/recommendations/metrics?days=28", 200).get("growth");
        assertThat(growth.get("heavy").get("learners").asInt()).isEqualTo(5);
        assertThat(growth.get("heavy").get("knownWordsPerWeek").asDouble()).isCloseTo(2.0, within(1e-9));
        assertThat(growth.get("light").get("learners").asInt()).isEqualTo(5);
        assertThat(growth.get("light").get("knownWordsPerWeek").asDouble()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void theWindowMustBeOneToThreeHundredSixtyFiveDays() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String user = api.signup();
        api.get(user, "/api/recommendations/metrics?days=0", 400);
        api.get(user, "/api/recommendations/metrics?days=366", 400);
        assertThat(api.get(user, "/api/recommendations/metrics", 200).get("days").asInt()).isEqualTo(28);
    }
}
