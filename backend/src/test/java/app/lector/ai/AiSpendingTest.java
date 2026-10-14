package app.lector.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.TestApi;
import app.lector.common.ApiException;
import app.lector.writing.MutableClock;
import app.lector.writing.OpenAiStub;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=ai-spending",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=1s",
        "app.openai.meaning-timeout=1s",
        "app.openai.system-daily-tokens=1000"
})
@AutoConfigureMockMvc
class AiSpendingTest {

    static final MutableClock CLOCK = new MutableClock();
    static final OpenAiStub AI = start();
    static final AtomicInteger DAYS = new AtomicInteger();
    static final String ADMIN = "forum-admin@test.co";

    private static OpenAiStub start() {
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
    AiClient ai;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    LocalDate day;

    @BeforeEach
    void setUp() {
        day = LocalDate.of(2030, 1, 1).plusDays(100L * DAYS.getAndIncrement());
        CLOCK.set(day.atTime(12, 0).toInstant(ZoneOffset.UTC));
        AI.reset();
    }

    private JsonNode lastRequest() {
        List<String> requests = AI.requests();
        return json.readTree(requests.getLast());
    }

    private Map<String, Object> usage(LocalDate on, AiJob job) {
        return jdbc.queryForMap("select calls, failures, tokens_in, tokens_out from ai_job_usage where day = ? and job = ?",
                on, job.name());
    }

    private void assertUsage(LocalDate on, AiJob job, long calls, long failures, long in, long out) {
        assertThat(usage(on, job)).containsEntry("calls", calls).containsEntry("failures", failures)
                .containsEntry("tokens_in", in).containsEntry("tokens_out", out);
    }

    private static String code(Throwable e) {
        return ((ApiException) e).code();
    }

    @Test
    void eachCallAsksForAtMostTheReplyItsJobNeeds() {
        ai.completeJson(AiJob.DEFINITION, "system", "Word: chat");
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(600);
        ai.completeJson(AiJob.EXAMPLE, "system", "Word: chat");
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(200);
        ai.completeJson(AiJob.CONTENT_REVIEW, "system", "x".repeat(5000), 0);
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(150);
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "x".repeat(5000), 0);
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(400);
        ai.quickReply(AiJob.WORD_MEANING, "system", "Le <b>chat</b>.");
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(200);
    }

    @Test
    void theCapGrowsWithTheInputForJobsWhoseReplyDoes() {
        ai.completeJson(AiJob.TRANSLATION, "system", "x".repeat(10));
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(210);
        ai.completeJson(AiJob.TRANSLATION, "system", "x".repeat(1000));
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(1200);
        ai.completeJson(AiJob.WRITING_FEEDBACK, "system", "x".repeat(300));
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(1200);
        ai.completeJson(AiJob.WRITING_GRADE, "system", "x".repeat(300), 0);
        assertThat(lastRequest().path("max_completion_tokens").asInt()).isEqualTo(1600);
    }

    @Test
    void aReplyCutOffByTheCapIsAFailureButItsTokensAreCounted() {
        AI.reply("{\"translation\":\"half");
        AI.usage(50, 210);
        AI.finishReason("length");
        assertThatThrownBy(() -> ai.completeJson(AiJob.TRANSLATION, "system", "x".repeat(10)))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(code(e)).isEqualTo("ai_error"));
        assertUsage(day, AiJob.TRANSLATION, 1, 1, 50, 210);
    }

    @Test
    void aSuccessfulCallAddsToTodaysCountForItsJob() {
        AI.usage(50, 20);
        ai.completeJson(AiJob.TRANSLATION, "system", "un");
        ai.completeJson(AiJob.TRANSLATION, "system", "deux");
        assertUsage(day, AiJob.TRANSLATION, 2, 0, 100, 40);
        AI.usage(30, 10);
        ai.completeJson(AiJob.TRANSLATION, "system", "trois");
        assertUsage(day, AiJob.TRANSLATION, 3, 0, 130, 50);
        assertThat(jdbc.queryForObject("select count(*) from ai_job_usage where day = ?", Long.class, day))
                .isEqualTo(1);
    }

    @Test
    void failedCallsAreCountedAsFailures() {
        AI.setFailing(true);
        assertThatThrownBy(() -> ai.completeJson(AiJob.EXAMPLE, "system", "Word: chat"))
                .isInstanceOf(ApiException.class);
        AI.setFailing(false);
        AI.replyRaw("not json");
        AI.usage(10, 5);
        assertThatThrownBy(() -> ai.completeJson(AiJob.EXAMPLE, "system", "Word: chat"))
                .isInstanceOf(ApiException.class);
        assertUsage(day, AiJob.EXAMPLE, 2, 2, 10, 5);
    }

    @Test
    void aCallThatTimesOutIsCountedAsIfItUsedItsWholeOutputCap() {
        AI.delay(Duration.ofMillis(1500));
        assertThatThrownBy(() -> ai.completeJson(AiJob.TRANSLATION, "system", "hello"))
                .isInstanceOf(ApiException.class);
        assertUsage(day, AiJob.TRANSLATION, 1, 1, 0, 205);
    }

    @Test
    void theCountIsKeptWhenTheCallersWorkIsRolledBack() {
        AI.usage(7, 3);
        tx.executeWithoutResult(status -> {
            ai.completeJson(AiJob.CONTENT_REVIEW, "system", "text", 0);
            status.setRollbackOnly();
        });
        assertUsage(day, AiJob.CONTENT_REVIEW, 1, 0, 7, 3);
    }

    @Test
    void daysAreUtcDays() {
        AI.usage(1, 1);
        CLOCK.set(day.atTime(23, 59).toInstant(ZoneOffset.UTC));
        ai.completeJson(AiJob.EXAMPLE, "system", "Word: chat");
        CLOCK.set(day.plusDays(1).atTime(0, 1).toInstant(ZoneOffset.UTC));
        ai.completeJson(AiJob.EXAMPLE, "system", "Word: chat");
        assertUsage(day, AiJob.EXAMPLE, 1, 0, 1, 1);
        assertUsage(day.plusDays(1), AiJob.EXAMPLE, 1, 0, 1, 1);
    }

    @Test
    void underTheCeilingSystemJobsRun() {
        AI.usage(500, 499);
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0);
        assertThat(ai.systemBudgetLeft()).isTrue();
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0);
        assertThat(AI.requests()).hasSize(2);
    }

    @Test
    void overTheCeilingSystemJobsAreRefusedWithoutACall() {
        AI.usage(600, 400);
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0);
        assertThat(ai.systemBudgetLeft()).isFalse();
        assertThatThrownBy(() -> ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(code(e)).isEqualTo("ai_ceiling"));
        assertThat(AI.requests()).hasSize(1);
        assertUsage(day, AiJob.TOPIC_TAGS, 1, 0, 600, 400);

        ai.completeJson(AiJob.DEFINITION, "system", "Word: chat");
        ai.completeJson(AiJob.CONTENT_REVIEW, "system", "text", 0);
        assertThat(AI.requests()).hasSize(3);

        CLOCK.set(day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        assertThat(ai.systemBudgetLeft()).isTrue();
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0);
        assertThat(AI.requests()).hasSize(4);
    }

    @Test
    void learnersCallsNeverCountTowardsTheSystemCeiling() {
        AI.usage(5000, 5000);
        for (AiJob job : AiJob.values()) {
            if (!job.system()) {
                ai.completeJson(job, "system", "text");
            }
        }
        assertThat(ai.systemBudgetLeft()).isTrue();
    }

    @Test
    void onlyTopicTaggingAndTranscriptTidyingAreSystemJobs() {
        assertThat(java.util.Arrays.stream(AiJob.values()).filter(AiJob::system))
                .containsExactly(AiJob.TOPIC_TAGS, AiJob.TRANSCRIPT_TIDY);
    }

    private String admin() throws Exception {
        String body = "{\"email\":\"" + ADMIN + "\",\"password\":\"password123\"}";
        var signup = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse();
        String reply = signup.getStatus() == 201 ? signup.getContentAsString()
                : mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reply).get("token").asString();
    }

    private JsonNode row(JsonNode report, String job) {
        for (JsonNode r : report.path("jobs")) {
            if (r.path("job").asString().equals(job)) {
                return r;
            }
        }
        throw new AssertionError("no row for " + job + " in " + report);
    }

    @Test
    void theAdminReportShowsUsagePerJobAndTodaysSystemTokens() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String admin = admin();
        Instant today = CLOCK.instant();

        AI.usage(1_000_000, 100_000);
        CLOCK.set(today.minus(Duration.ofDays(10)));
        ai.completeJson(AiJob.DEFINITION, "system", "Word: chat");
        CLOCK.set(today.minus(Duration.ofDays(3)));
        ai.completeJson(AiJob.DEFINITION, "system", "Word: chat");
        CLOCK.set(today);
        AI.usage(100, 20);
        ai.completeJson(AiJob.DEFINITION, "system", "Word: chat");
        ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0);
        AI.setFailing(true);
        assertThatThrownBy(() -> ai.completeJson(AiJob.TOPIC_TAGS, "system", "text", 0))
                .isInstanceOf(ApiException.class);
        AI.setFailing(false);

        JsonNode week = api.get(admin, "/api/admin/ai?days=7", 200);
        assertThat(week.path("days").asInt()).isEqualTo(7);
        assertThat(week.path("today").path("day").asString()).isEqualTo(day.toString());
        assertThat(week.path("today").path("systemTokens").asLong()).isEqualTo(120);
        assertThat(week.path("today").path("ceiling").asLong()).isEqualTo(1000);
        assertThat(week.path("jobs")).hasSize(2);
        assertThat(week.path("jobs").get(0).path("job").asString()).isEqualTo("DEFINITION");

        JsonNode definitions = row(week, "DEFINITION");
        assertThat(definitions.path("system").asBoolean()).isFalse();
        assertThat(definitions.path("calls").asLong()).isEqualTo(2);
        assertThat(definitions.path("failures").asLong()).isZero();
        assertThat(definitions.path("tokensIn").asLong()).isEqualTo(1_000_100);
        assertThat(definitions.path("tokensOut").asLong()).isEqualTo(100_020);
        assertThat(definitions.path("cost").asDouble()).isCloseTo(0.15 + 0.06 + (100 * 0.15 + 20 * 0.6) / 1e6,
                within(1e-9));

        JsonNode tags = row(week, "TOPIC_TAGS");
        assertThat(tags.path("system").asBoolean()).isTrue();
        assertThat(tags.path("calls").asLong()).isEqualTo(2);
        assertThat(tags.path("failures").asLong()).isEqualTo(1);

        JsonNode total = week.path("total");
        assertThat(total.path("calls").asLong()).isEqualTo(4);
        assertThat(total.path("failures").asLong()).isEqualTo(1);
        assertThat(total.path("tokensIn").asLong()).isEqualTo(1_000_200);
        assertThat(total.path("cost").asDouble()).isCloseTo(definitions.path("cost").asDouble()
                + tags.path("cost").asDouble(), within(1e-9));
        assertThat(week.path("prices").path("aiOutputPerMillionTokens").asDouble()).isEqualTo(0.6);

        JsonNode month = api.get(admin, "/api/admin/ai?days=30", 200);
        assertThat(row(month, "DEFINITION").path("calls").asLong()).isEqualTo(3);
    }

    @Test
    void anEmptyPeriodHasNoRowsAndZeroTotals() throws Exception {
        JsonNode report = new TestApi(mvc, json).get(admin(), "/api/admin/ai?days=7", 200);
        assertThat(report.path("jobs")).isEmpty();
        assertThat(report.path("total").path("calls").asLong()).isZero();
        assertThat(report.path("total").path("cost").asDouble()).isZero();
        assertThat(report.path("today").path("systemTokens").asLong()).isZero();
    }

    @Test
    void onlyAdminsSeeTheReport() throws Exception {
        TestApi api = new TestApi(mvc, json);
        assertThat(api.get(api.signup(), "/api/admin/ai", 403).path("code").asString()).isEqualTo("forbidden");
        api.get(admin(), "/api/admin/ai?days=0", 400);
        api.get(admin(), "/api/admin/ai?days=366", 400);
    }
}
