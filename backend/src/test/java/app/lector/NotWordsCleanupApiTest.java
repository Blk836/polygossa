package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.admin.AdminNotWords;
import app.lector.ai.AiJob;
import app.lector.ai.AiJobUsageRepository;
import app.lector.ai.AiSpending;
import app.lector.text.NotWords;
import app.lector.writing.OpenAiStub;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=notwordscleanup",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0",
        "app.openai.system-daily-tokens=1000000"
})
@AutoConfigureMockMvc
class NotWordsCleanupApiTest {

    private static final String ADMIN = "forum-admin@test.co";
    private static final String MARKER = NotWordsApiTest.MARKER;
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
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

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    AiJobUsageRepository jobUsage;

    @Autowired
    AiSpending spending;

    TestApi api;
    String admin;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        jobUsage.deleteAll();
        jdbc.update("delete from word_verdicts");
        jdbc.update("update texts set language = 'DE' where language = 'FR'");
        jdbc.update("update vocabulary_entries set language = 'DE' where language = 'FR'");
        api = new TestApi(mvc, json);
        admin = admin();
        user = api.signupPro();
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

    private static void misspelt(String... words) {
        AI.replyWhen(MARKER, "{\"names\":[],\"foreign\":[],\"misspelt\":["
                + NotWordsApiTest.quoted(Arrays.asList(words)) + "]}");
    }

    private long importWithoutVerdicts(String content) throws Exception {
        AI.setFailing(true);
        long id = api.createText(user, "fr", content, false);
        AI.reset();
        return id;
    }

    private void known(String term, String extra) throws Exception {
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\",\"status\":\"known\""
                + extra + "}", 201);
    }

    private String status(String term) throws Exception {
        for (JsonNode e : api.get(user, "/api/vocabulary?language=fr", 200).get("items")) {
            if (e.get("term").asString().equals(term)) {
                return e.get("status").asString();
            }
        }
        return null;
    }

    private JsonNode plan() throws Exception {
        return api.get(admin, "/api/admin/not-words?language=fr", 200);
    }

    private JsonNode run(int maxCalls, long maxTokens) throws Exception {
        return api.post(admin, "/api/admin/not-words", "{\"language\":\"fr\",\"maxCalls\":" + maxCalls
                + ",\"maxTokens\":" + maxTokens + "}", 200);
    }

    private static String manyWords(int n) {
        StringBuilder out = new StringBuilder("Voici");
        for (int i = 0; i < n - 1; i++) {
            out.append(" mot").append((char) ('a' + i / 26)).append((char) ('a' + i % 26));
        }
        return out.append('.').toString();
    }

    private List<String> requests() {
        return AI.requests().stream().filter(r -> r.contains(MARKER)).toList();
    }

    @Test
    void onlyAdminsCanSeeOrRunTheCleanup() throws Exception {
        api.get(user, "/api/admin/not-words?language=fr", 403);
        api.post(user, "/api/admin/not-words", "{\"language\":\"fr\",\"maxCalls\":1,\"maxTokens\":1000}", 403);
    }

    @Test
    void aDryRunSaysWhatTheCleanupWouldCostAndChangesNothing() throws Exception {
        importWithoutVerdicts("Il est imé.");
        importWithoutVerdicts("Il chante bien.");
        known("klamotten", "");
        JsonNode plan = plan();
        assertThat(plan.get("texts").asInt()).isEqualTo(2);
        assertThat(plan.get("words").asInt()).isEqualTo(6);
        assertThat(plan.get("calls").asInt()).isEqualTo(1);
        assertThat(plan.get("estimatedTokens").asLong()).isPositive();
        assertThat(plan.get("estimatedCost").asDouble()).isPositive();
        assertThat(AI.requests()).isEmpty();
        assertThat(status("klamotten")).isEqualTo("known");
        assertThat(plan().get("words").asInt()).isEqualTo(6);
    }

    @Test
    void aTrialJudgesAFewBatchesShowsTheirVerdictsAndKeepsThem() throws Exception {
        importWithoutVerdicts(manyWords(350));
        misspelt("motaa", "motab");
        JsonNode report = run(3, 1_000_000);
        assertThat(report.get("calls").asInt()).isEqualTo(3);
        assertThat(report.get("notWords").valueStream().map(JsonNode::asString)).contains("motaa", "motab");
        assertThat(report.get("wordsLeft").asInt()).isEqualTo(50);
        assertThat(report.get("stopped").asString()).isEqualTo("calls");
        AI.reset();
        misspelt();
        JsonNode rest = run(10, 1_000_000);
        assertThat(requests()).hasSize(1);
        assertThat(NotWordsApiTest.wordsSent(json, requests().getFirst())).hasSize(50);
        assertThat(rest.get("wordsLeft").asInt()).isZero();
        assertThat(rest.get("stopped").asString()).isEqualTo("done");
        assertThat(plan().get("words").asInt()).isZero();
    }

    @Test
    void theRunStopsBeforeGoingOverItsTokenCap() throws Exception {
        importWithoutVerdicts(manyWords(350));
        misspelt();
        AI.usage(1000, 50);
        JsonNode report = run(10, 2000);
        assertThat(report.get("calls").asInt()).isEqualTo(1);
        assertThat(report.get("tokensIn").asLong() + report.get("tokensOut").asLong()).isLessThanOrEqualTo(2000);
        assertThat(report.get("stopped").asString()).isEqualTo("cap");
        assertThat(report.get("wordsLeft").asInt()).isEqualTo(250);
    }

    @Test
    void theRunStopsAtTheDailyCeilingForSystemJobs() throws Exception {
        importWithoutVerdicts("Il est imé.");
        jobUsage.add(spending.today(), AiJob.TOPIC_TAGS.name(), 0, 0, 1_000_000);
        JsonNode report = run(10, 1_000_000);
        assertThat(report.get("calls").asInt()).isZero();
        assertThat(report.get("stopped").asString()).isEqualTo("ceiling");
        assertThat(requests()).isEmpty();
    }

    @Test
    void aFailedCallStopsTheRunAndLeavesItsWordsForNextTime() throws Exception {
        importWithoutVerdicts("Il est imé.");
        AI.setFailing(true);
        JsonNode report = run(10, 1_000_000);
        assertThat(report.get("stopped").asString()).isEqualTo("failed");
        assertThat(report.get("wordsLeft").asInt()).isEqualTo(3);
    }

    @Test
    void theCleanupNeverRunsByItself() {
        for (Class<?> type : List.of(AdminNotWords.class, NotWords.class)) {
            assertThat(ApplicationRunner.class.isAssignableFrom(type)).isFalse();
            assertThat(CommandLineRunner.class.isAssignableFrom(type)).isFalse();
            for (Method m : type.getDeclaredMethods()) {
                assertThat(m.isAnnotationPresent(Scheduled.class)).as(m.getName()).isFalse();
            }
        }
    }

    @Test
    void textsAlreadyInTheAppGetTheirNotWordsMarkedAndTheirCountsRedone() throws Exception {
        long id = importWithoutVerdicts("Le matin il mange zzaa une pomme. Puis il boit zzbb du lait.");
        int before = api.get(user, "/api/texts/" + id, 200).get("text").get("uniqueWordCount").asInt();
        misspelt("zzaa", "zzbb");
        JsonNode report = run(10, 1_000_000);
        assertThat(report.get("textsUpdated").asInt()).isEqualTo(1);
        JsonNode detail = api.get(user, "/api/texts/" + id, 200);
        assertThat(detail.get("setAside").valueStream().map(JsonNode::asString)).containsExactlyInAnyOrder("zzaa", "zzbb");
        assertThat(detail.get("text").get("uniqueWordCount").asInt()).isEqualTo(before - 2);
        assertThat(api.post(user, "/api/texts/" + id + "/complete", "", 200).get("markedKnown").asInt())
                .isEqualTo(before - 2);
    }

    @Test
    void knownWordsThatArentWordsMoveToIgnoredAndCanBeSetBack() throws Exception {
        known("imé", "");
        known("until", "");
        known("chat", "");
        misspelt("imé", "until");
        JsonNode report = run(10, 1_000_000);
        assertThat(report.get("wordsIgnored").asInt()).isEqualTo(2);
        assertThat(status("imé")).isEqualTo("ignored");
        assertThat(status("until")).isEqualTo("ignored");
        assertThat(status("chat")).isEqualTo("known");
        known("imé", "");
        assertThat(status("imé")).isEqualTo("known");
        run(10, 1_000_000);
        assertThat(status("imé")).isEqualTo("known");
    }

    @Test
    void wordsWithANoteOrTagsOrThatIAmLearningAreLeftAlone() throws Exception {
        known("british", ",\"note\":\"from the BMJ\"");
        known("medical", ",\"tags\":[\"news\"]");
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"habe\",\"status\":\"learning\"}", 201);
        misspelt("british", "medical", "habe");
        assertThat(run(10, 1_000_000).get("wordsIgnored").asInt()).isZero();
        assertThat(status("british")).isEqualTo("known");
        assertThat(status("medical")).isEqualTo("known");
        assertThat(status("habe")).isEqualTo("learning");
    }

    @Test
    void theCleanupIsRecordedInTheAdminLog() throws Exception {
        known("imé", "");
        misspelt("imé");
        run(10, 1_000_000);
        assertThat(api.get(admin, "/api/admin/actions", 200).toString()).contains("not-words cleanup");
    }
}
