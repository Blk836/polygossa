package app.lector.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import app.lector.TestApi;
import app.lector.writing.MutableClock;
import app.lector.writing.OpenAiStub;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Feature: a daily allowance of AI calls per user, so one learner can't drain the AI budget. */
@SpringBootTest(properties = {
        "test.database=aiallowance",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.daily-limit=3"
})
@AutoConfigureMockMvc
class AiAllowanceApiTest {

    static final MutableClock CLOCK = new MutableClock();
    private static final OpenAiStub AI = startAi();
    private static final String LIMIT_MESSAGE = "You've used today's AI allowance; it resets at midnight";

    private static OpenAiStub startAi() {
        try {
            return new OpenAiStub();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }

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

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        CLOCK.set(Instant.parse("2026-10-05T09:00:00Z")); // a Monday
        AI.reset();
        AI.reply("{\"translation\": \"hello\", \"sentence\": \"Hola.\", \"senses\": [{\"definition\": \"hi\"}]}");
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private JsonNode translate(String token, int status) throws Exception {
        return api.post(token, "/api/dictionary/translate", "{\"language\":\"es\",\"text\":\"hola\"}", status);
    }

    private void useAllowance(String token) throws Exception {
        for (int i = 0; i < 3; i++) {
            translate(token, 200);
        }
    }

    private static void assertLimitError(JsonNode error) {
        assertThat(error.get("code").asString()).isEqualTo("ai_limit");
        assertThat(error.get("message").asString()).isEqualTo(LIMIT_MESSAGE);
    }

    @Test
    void callsBeyondTheDailyLimitAreRefusedWithoutReachingTheAi() throws Exception {
        useAllowance(user);
        int sent = AI.requests().size();

        assertLimitError(translate(user, 429));
        assertLimitError(api.get(user, "/api/dictionary/example?language=es&term=hola", 429));
        assertLimitError(api.get(user, "/api/dictionary/explain?language=es&term=zzqx", 429));
        assertLimitError(api.post(user, "/api/writing", "{\"language\":\"es\",\"content\":\"Hola amigo\"}", 429));
        assertThat(AI.requests()).hasSize(sent);
    }

    @Test
    void eachKindOfAiCallUsesTheAllowance() throws Exception {
        api.get(user, "/api/dictionary/example?language=es&term=hola", 200);
        api.get(user, "/api/dictionary/explain?language=es&term=zzqx", 200);
        api.post(user, "/api/writing", "{\"language\":\"es\",\"content\":\"Hola amigo\"}", 201);
        translate(user, 429);
    }

    // lingq-style-lookup.feature, "Pro asks the AI for an explanation on demand".

    @Test
    void aLookupNeverCallsTheAiButExplainDoesInTheLearnersLanguage() throws Exception {
        api.patch(user, "/api/me", "{\"nativeLanguage\":\"fr\"}", 200);
        api.get(user, "/api/dictionary?language=es&term=zzqx", 200);
        assertThat(AI.requests()).isEmpty();
        JsonNode explained = api.send(get("/api/dictionary/explain").param("language", "es").param("term", "zzqx")
                .param("context", "Un zzqx"), user, 200);
        assertThat(explained.get("senses").get(0).get("definition").asString()).isEqualTo("hi");
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().get(0)).contains("zzqx").contains("French").contains("Un zzqx");
    }

    @Test
    void explainIsForPro() throws Exception {
        api.get(api.signup(), "/api/dictionary/explain?language=es&term=zzqx", 402);
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void aWritingTestHandedInOverTheLimitIsSavedUngraded() throws Exception {
        long id = api.post(user, "/api/writing/tests", "{\"language\":\"es\",\"level\":\"A1\"}", 201).get("id").asLong();
        useAllowance(user);
        int sent = AI.requests().size();
        JsonNode saved = api.post(user, "/api/writing/tests/" + id + "/submit",
                "{\"content\":\"" + "palabra ".repeat(30).strip() + "\"}", 200);
        assertThat(saved.get("status").asString()).isEqualTo("ungraded");
        assertThat(saved.get("gradeError").asString()).isEqualTo(LIMIT_MESSAGE);
        assertThat(saved.get("content").asString()).startsWith("palabra palabra");
        assertThat(AI.requests()).hasSize(sent);

        CLOCK.advance(Duration.ofDays(1));
        AI.reply("{\"score\": 70, \"level\": \"A1\"}");
        JsonNode graded = api.post(user, "/api/writing/tests/" + id + "/grade", "{}", 200);
        assertThat(graded.get("status").asString()).isEqualTo("graded");
    }

    @Test
    void failedCallsDoNotUseTheAllowance() throws Exception {
        AI.setFailing(true);
        for (int i = 0; i < 5; i++) {
            translate(user, 502);
        }
        AI.setFailing(false);
        useAllowance(user);
        translate(user, 429);
    }

    @Test
    void theAllowanceResetsAtMidnightInTheUsersTimezone() throws Exception {
        api.patch(user, "/api/me", "{\"timezone\":\"Asia/Tokyo\"}", 200);
        CLOCK.set(Instant.parse("2026-10-05T14:00:00Z")); // 23:00 Monday in Tokyo
        useAllowance(user);
        translate(user, 429);

        CLOCK.set(Instant.parse("2026-10-05T15:01:00Z")); // 00:01 Tuesday in Tokyo, still Monday in UTC
        translate(user, 200);
    }

    @Test
    void theAllowanceDoesNotResetBeforeMidnight() throws Exception {
        useAllowance(user);
        CLOCK.set(Instant.parse("2026-10-05T23:59:00Z"));
        translate(user, 429);
    }

    @Test
    void eachUserHasTheirOwnAllowance() throws Exception {
        useAllowance(api.signupPro());
        translate(user, 200);
    }

    @Test
    void theFreePlanIsAskedToUpgradeBeforeTheAllowanceIsConsidered() throws Exception {
        String free = api.signup();
        api.post(free, "/api/writing/tests", "{\"language\":\"es\",\"level\":\"A1\"}", 402);
        translate(free, 402);
        assertThat(AI.requests()).isEmpty();
    }
}
