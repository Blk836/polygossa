package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

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

/** GET /api/dashboard/header: the streak for the header flame, how long is left of the learner's day, and known words. */
@ClockApiTest
class DashboardHeaderApiTest {

    static final MutableClock CLOCK = TestClock.CLOCK;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private JsonNode streakIn(String zone, String now) throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.patch(token, "/api/me", "{\"timezone\":\"" + zone + "\"}", 200);
        CLOCK.set(Instant.parse(now));
        return api.get(token, "/api/dashboard/header", 200);
    }

    @Test
    void aNewLearnerHasNoStreak() throws Exception {
        JsonNode s = streakIn("UTC", "2026-10-01T09:00:00Z");
        assertThat(s.get("current").asInt()).isZero();
        assertThat(s.get("best").asInt()).isZero();
        assertThat(s.get("activeToday").asBoolean()).isFalse();
    }

    @Test
    void secondsLeftRunToMidnightInUtc() throws Exception {
        assertThat(streakIn("UTC", "2026-10-01T09:00:00Z").get("secondsLeftToday").asLong()).isEqualTo(15 * 3600);
    }

    @Test
    void secondsLeftRunToMidnightInTheLearnersTimeZone() throws Exception {
        // 09:00 UTC is 05:00 in New York (EDT): 19 hours to go.
        assertThat(streakIn("America/New_York", "2026-10-01T09:00:00Z").get("secondsLeftToday").asLong()).isEqualTo(19 * 3600);
    }

    @Test
    void theDayClocksGoBackHasTwentyFiveHours() throws Exception {
        // Midnight EDT on 1 Nov 2026; clocks fall back at 02:00, so the day is 25 hours long.
        assertThat(streakIn("America/New_York", "2026-11-01T04:00:00Z").get("secondsLeftToday").asLong()).isEqualTo(25 * 3600);
    }

    @Test
    void aSecondBeforeMidnightLeavesOneSecond() throws Exception {
        assertThat(streakIn("UTC", "2026-10-01T23:59:59Z").get("secondsLeftToday").asLong()).isEqualTo(1);
    }

    @Test
    void countsKnownWordsInTheChosenLanguageOrAll() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"perro\",\"status\":\"known\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"casa\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"el\",\"status\":\"ignored\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"chat\",\"status\":\"known\"}", 201);
        assertThat(api.get(token, "/api/dashboard/header?language=es", 200).get("knownWords").asLong()).isEqualTo(2);
        assertThat(api.get(token, "/api/dashboard/header?language=fr", 200).get("knownWords").asLong()).isEqualTo(1);
        assertThat(api.get(token, "/api/dashboard/header?language=de", 200).get("knownWords").asLong()).isZero();
        assertThat(api.get(token, "/api/dashboard/header", 200).get("knownWords").asLong()).isEqualTo(3);
    }

    @Test
    void otherLearnersKnownWordsAreNotCounted() throws Exception {
        TestApi api = new TestApi(mvc, json);
        api.post(api.signup(), "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}", 201);
        assertThat(api.get(api.signup(), "/api/dashboard/header?language=es", 200).get("knownWords").asLong()).isZero();
    }

    @Test
    void anUnknownLanguageIsABadRequest() throws Exception {
        TestApi api = new TestApi(mvc, json);
        api.get(api.signup(), "/api/dashboard/header?language=xx", 400);
    }

    @Test
    void needsSigningIn() throws Exception {
        new TestApi(mvc, json).get(null, "/api/dashboard/header", 401);
    }
}
