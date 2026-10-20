package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class FreePlanGoalApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    private void assertGoal(String token, String kind, int target) throws Exception {
        JsonNode me = api.get(token, "/api/me", 200).get("dailyGoal");
        assertThat(me.get("kind").asString()).isEqualTo(kind);
        assertThat(me.get("target").asInt()).isEqualTo(target);
        JsonNode header = api.get(token, "/api/dashboard/header", 200).get("goal");
        assertThat(header.get("kind").asString()).isEqualTo(kind);
        assertThat(header.get("target").asInt()).isEqualTo(target);
        JsonNode dashboard = api.get(token, "/api/dashboard", 200).get("goal");
        assertThat(dashboard.get("kind").asString()).isEqualTo(kind);
    }

    @Test
    void aNewFreeAccountsGoalIsWordsRead() throws Exception {
        assertGoal(api.signup(), "words_read", 1000);
    }

    @Test
    void aNewProAccountsGoalIsStillReviews() throws Exception {
        assertGoal(api.signupPro(), "reviews", 20);
    }

    @Test
    void aFreeAccountWithAReviewGoalGetsWordsReadAndTheChoiceComesBackOnPro() throws Exception {
        String token = api.signupPro();
        api.patch(token, "/api/me", "{\"dailyGoal\":{\"kind\":\"reviews\",\"target\":35}}", 200);
        api.post(token, "/api/me/plan", "{\"tier\":\"FREE\"}", 200);
        assertGoal(token, "words_read", 1000);
        api.post(token, "/api/me/plan", "{\"tier\":\"PRO\"}", 200);
        assertGoal(token, "reviews", 35);
    }

    @Test
    void aFreeAccountKeepsAReachableGoalItChose() throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"dailyGoal\":{\"kind\":\"minutes_read\",\"target\":25}}", 200);
        assertGoal(token, "minutes_read", 25);
    }
}
