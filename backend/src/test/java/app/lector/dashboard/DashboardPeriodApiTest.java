package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** GET /api/dashboard?period=…: the Progress page's stats for the last week, month, quarter, year or all time. */
@ApiTest
class DashboardPeriodApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private static JsonNode growthOf(JsonNode dashboard, String language) {
        for (JsonNode g : dashboard.get("growth")) {
            if (language.equals(g.get("language").asString())) {
                return g.get("known");
            }
        }
        throw new AssertionError("no growth for " + language);
    }

    @Test
    void withoutAPeriodTheStatsCoverTheLastWeek() throws Exception {
        TestApi api = new TestApi(mvc, json);
        JsonNode p = api.get(api.signup(), "/api/dashboard", 200).get("period");
        assertThat(p.get("period").asString()).isEqualTo("week");
        assertThat(p.get("days").asInt()).isEqualTo(7);
        assertThat(p.get("current").get("activeDays").asInt()).isZero();
        assertThat(p.get("previous").get("activeDays").asInt()).isZero();
    }

    @Test
    void eachPeriodHasItsLength() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        for (String[] c : new String[][] {{"week", "7"}, {"month", "30"}, {"quarter", "90"}, {"year", "365"}}) {
            JsonNode p = api.get(token, "/api/dashboard?period=" + c[0], 200).get("period");
            assertThat(p.get("period").asString()).isEqualTo(c[0]);
            assertThat(p.get("days").asInt()).isEqualTo(Integer.parseInt(c[1]));
            assertThat(p.get("previous").isNull()).isFalse();
        }
    }

    @Test
    void aMonthCountsTodaysPracticeAgainstAnEmptyMonthBefore() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"perro\"}", 201);
        JsonNode p = api.get(token, "/api/dashboard?period=month", 200).get("period");
        assertThat(p.get("current").get("wordsSaved").asLong()).isEqualTo(2);
        assertThat(p.get("current").get("wordsKnown").asLong()).isEqualTo(1);
        assertThat(p.get("current").get("activeDays").asInt()).isEqualTo(1);
        assertThat(p.get("previous").get("wordsSaved").asLong()).isZero();
    }

    @Test
    void allTimeRunsFromSigningUpWithNothingToCompareAgainst() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        JsonNode p = api.get(token, "/api/dashboard?period=all", 200).get("period");
        assertThat(p.get("period").asString()).isEqualTo("all");
        assertThat(p.get("days").asInt()).isEqualTo(1);
        assertThat(p.get("current").get("wordsSaved").asLong()).isEqualTo(1);
        assertThat(p.get("previous").isNull()).isTrue();
    }

    @Test
    void theGrowthCurveFollowsThePeriod() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}", 201);
        assertThat(growthOf(api.get(token, "/api/dashboard?period=month", 200), "es")).hasSize(30);
        assertThat(growthOf(api.get(token, "/api/dashboard?period=year", 200), "es")).hasSize(365);
        JsonNode all = growthOf(api.get(token, "/api/dashboard?period=all", 200), "es");
        assertThat(all).hasSize(1);
        assertThat(all.get(0).get("value").asLong()).isEqualTo(1);
    }

    @Test
    void anUnknownPeriodIsABadRequest() throws Exception {
        TestApi api = new TestApi(mvc, json);
        api.get(api.signup(), "/api/dashboard?period=decade", 400);
    }
}
