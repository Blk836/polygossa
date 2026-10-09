package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class DashboardActivityApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private JsonNode activity(TestApi api, String token) throws Exception {
        return api.get(token, "/api/dashboard", 200).get("activity");
    }

    private static JsonNode today(JsonNode activity) {
        JsonNode days = activity.get("days");
        return days.get(days.size() - 1);
    }

    @Test
    void aNewLearnerHasNoStreakAndTwelveEmptyWeeks() throws Exception {
        TestApi api = new TestApi(mvc, json);
        JsonNode a = activity(api, api.signup());
        assertThat(a.get("streak").get("current").asInt()).isZero();
        assertThat(a.get("streak").get("best").asInt()).isZero();
        assertThat(a.get("streak").get("activeToday").asBoolean()).isFalse();
        assertThat(a.get("days")).hasSize(84);
        for (JsonNode d : a.get("days")) {
            assertThat(d.get("active").asBoolean()).isFalse();
        }
        assertThat(a.get("thisWeek").get("activeDays").asInt()).isZero();
    }

    @Test
    void savingAWordTodayStartsAStreakOfOne() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"perro\",\"status\":\"known\"}", 201);
        JsonNode a = activity(api, token);
        assertThat(a.get("streak").get("current").asInt()).isEqualTo(1);
        assertThat(a.get("streak").get("best").asInt()).isEqualTo(1);
        assertThat(a.get("streak").get("activeToday").asBoolean()).isTrue();
        assertThat(today(a).get("wordsSaved").asLong()).isEqualTo(2);
        assertThat(today(a).get("wordsKnown").asLong()).isEqualTo(1);
        assertThat(a.get("thisWeek").get("wordsKnown").asLong()).isEqualTo(1);
        assertThat(a.get("thisWeek").get("activeDays").asInt()).isEqualTo(1);
    }

    @Test
    void theHeaderStreakMatchesTheDashboardStreak() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        JsonNode streak = api.get(token, "/api/dashboard/header", 200);
        JsonNode dashboard = activity(api, token).get("streak");
        assertThat(streak.get("current").asInt()).isEqualTo(dashboard.get("current").asInt()).isEqualTo(1);
        assertThat(streak.get("best").asInt()).isEqualTo(dashboard.get("best").asInt());
        assertThat(streak.get("activeToday").asBoolean()).isTrue();
        assertThat(streak.get("secondsLeftToday").asLong()).isBetween(1L, 86_400L);
    }

    @Test
    void openingATextForAFewSecondsIsNotPractice() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        long text = api.createText(token, "es", "Uno dos.", false);
        long session = api.post(token, "/api/sessions", "{\"textId\":" + text + "}", 201).get("id").asLong();
        api.post(token, "/api/sessions/" + session + "/heartbeat", "{\"seconds\":3}", 200);
        JsonNode a = activity(api, token);
        assertThat(today(a).get("readingSeconds").asLong()).isEqualTo(3);
        assertThat(a.get("streak").get("activeToday").asBoolean()).isFalse();
    }

    @Test
    void reviewingAndHandingInWritingArePractice() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signupPro();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        long card = api.get(token, "/api/review/queue", 200).get(0).get("id").asLong();
        api.post(token, "/api/review/word/" + card, "{\"rating\":\"easy\"}", 200);
        long test = api.post(token, "/api/writing/tests", "{\"language\":\"fr\",\"level\":\"A1\"}", 201).get("id").asLong();
        api.post(token, "/api/writing/tests/" + test + "/submit", "{\"content\":\"" + "mot ".repeat(30).strip() + "\"}", 200);
        JsonNode day = today(activity(api, token));
        assertThat(day.get("reviews").asLong()).isEqualTo(1);
        assertThat(day.get("writingTests").asLong()).isEqualTo(1);
    }

    @Test
    void otherLearnersPracticeIsNotCounted() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String other = api.signup();
        api.post(other, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        assertThat(activity(api, api.signup()).get("streak").get("activeToday").asBoolean()).isFalse();
    }
}
