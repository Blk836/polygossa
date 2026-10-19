package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.ClockApiTest;
import app.lector.TestApi;
import app.lector.TestClock;
import app.lector.writing.MutableClock;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ClockApiTest
class DashboardTodayApiTest {

    static final MutableClock CLOCK = TestClock.CLOCK;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String learnerIn(TestApi api, String zone) throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"timezone\":\"" + zone + "\"}", 200);
        return token;
    }

    private static void save(TestApi api, String token, String term, boolean known) throws Exception {
        String status = known ? ",\"status\":\"known\"" : "";
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"" + term + "\"" + status + "}", 201);
    }

    @Test
    void todayIsOneDayComparedWithYesterday() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = learnerIn(api, "UTC");
        CLOCK.set(Instant.parse("2026-10-01T10:00:00Z"));
        save(api, token, "gato", true);
        CLOCK.set(Instant.parse("2026-10-02T09:00:00Z"));
        save(api, token, "perro", true);
        save(api, token, "casa", true);
        save(api, token, "mesa", false);
        JsonNode p = api.get(token, "/api/dashboard?period=today", 200).get("period");
        assertThat(p.get("period").asString()).isEqualTo("today");
        assertThat(p.get("days").asInt()).isEqualTo(1);
        assertThat(p.get("current").get("wordsKnown").asLong()).isEqualTo(2);
        assertThat(p.get("current").get("wordsSaved").asLong()).isEqualTo(3);
        assertThat(p.get("current").get("activeDays").asInt()).isEqualTo(1);
        assertThat(p.get("previous").get("wordsKnown").asLong()).isEqualTo(1);
        assertThat(p.get("previous").get("activeDays").asInt()).isEqualTo(1);
    }

    @Test
    void nothingTodayOrYesterdayIsAllZero() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = learnerIn(api, "UTC");
        CLOCK.set(Instant.parse("2026-10-05T09:00:00Z"));
        JsonNode p = api.get(token, "/api/dashboard?period=today", 200).get("period");
        assertThat(p.get("current").get("wordsSaved").asLong()).isZero();
        assertThat(p.get("current").get("readingSeconds").asLong()).isZero();
        assertThat(p.get("previous").get("wordsSaved").asLong()).isZero();
    }

    @Test
    void todayStartsAtTheLearnersMidnight() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = learnerIn(api, "Asia/Tokyo");
        CLOCK.set(Instant.parse("2026-10-01T14:30:00Z"));
        save(api, token, "gato", true);
        CLOCK.set(Instant.parse("2026-10-01T15:30:00Z"));
        save(api, token, "perro", true);
        JsonNode p = api.get(token, "/api/dashboard?period=today", 200).get("period");
        assertThat(p.get("current").get("wordsKnown").asLong()).isEqualTo(1);
        assertThat(p.get("previous").get("wordsKnown").asLong()).isEqualTo(1);
    }

    @Test
    void theGrowthCurveForTodayCoversTheLastWeek() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = learnerIn(api, "UTC");
        CLOCK.set(Instant.parse("2026-10-02T09:00:00Z"));
        save(api, token, "gato", true);
        JsonNode growth = api.get(token, "/api/dashboard?period=today", 200).get("growth");
        assertThat(growth).isNotEmpty();
        for (JsonNode g : growth) {
            assertThat(g.get("known")).hasSize(7);
        }
    }

    @Test
    void anUnknownPeriodNamesTodayAmongTheValidOnes() throws Exception {
        TestApi api = new TestApi(mvc, json);
        api.get(api.signup(), "/api/dashboard?period=decade", 400);
        assertThatThrownBy(() -> StatsPeriod.parse("decade"))
                .hasMessage("period must be one of: today, week, month, quarter, year, all");
        assertThat(StatsPeriod.parse(" Today ")).isEqualTo(StatsPeriod.TODAY);
    }
}
