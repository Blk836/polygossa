package app.lector.writing;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
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

/** Feature: a short timed writing test on a set situation, graded by AI at the end. */
@SpringBootTest(properties = {
        "test.database=writingtest",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.model=test-model",
        "app.openai.timeout=2s"
})
@AutoConfigureMockMvc
class WritingTestApiTest {

    static final MutableClock CLOCK = new MutableClock();
    private static final OpenAiStub AI = startAi();
    private static final String GRADE = """
            {"score": 76, "level": "B1",
             "rubric": {"task": {"score": 4, "comment": "All points covered"}, "grammar": {"score": 3, "comment": "Agreement"},
                        "vocabulary": {"score": 4, "comment": "Varied"}, "coherence": {"score": 4, "comment": "Clear"}},
             "corrections": [{"original": "je suis allé", "corrected": "je suis allée", "explanation": "Agreement"}],
             "correctedText": "Texte corrigé.", "summary": "Good job."}
            """;

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
        AI.reset();
        AI.reply(GRADE);
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private JsonNode start(String token, String language, String level, int status) throws Exception {
        return api.post(token, "/api/writing/tests", "{\"language\":\"" + language + "\",\"level\":\"" + level + "\"}", status);
    }

    private JsonNode submit(String token, long id, String content, int status) throws Exception {
        return api.post(token, "/api/writing/tests/" + id + "/submit",
                json.writeValueAsString(java.util.Map.of("content", content)), status);
    }

    private static String words(int n) {
        return "mot ".repeat(n).strip();
    }

    // ---- starting ----

    @Test
    void startsATimedTestOnASituationFromTheBank() throws Exception {
        JsonNode t = start(user, "fr", "B1", 201);
        assertThat(t.get("status").asString()).isEqualTo("in_progress");
        assertThat(t.get("language").asString()).isEqualTo("fr");
        assertThat(t.get("level").asString()).isEqualTo("B1");
        assertThat(t.get("prompt").asString()).hasSizeGreaterThan(30);
        assertThat(t.get("minWords").asInt()).isEqualTo(60);
        assertThat(t.get("unit").asString()).isEqualTo("words");
        assertThat(t.get("timeLimitSeconds").asInt()).isEqualTo(300);
        Instant started = Instant.parse(t.get("startedAt").asString());
        assertThat(Instant.parse(t.get("deadline").asString())).isEqualTo(started.plus(Duration.ofMinutes(5)));
        assertThat(t.has("grade")).isFalse();
    }

    @Test
    void japaneseTestsAreRefused() throws Exception {
        // Paused for learning (learning-languages.feature); character counting stays covered by WritingRulesTest.
        assertThat(start(user, "ja", "A2", 400).get("code").asString()).isEqualTo("language_not_offered");
    }

    @Test
    void startingAgainReturnsTheRunningTestSoThePromptCannotBeRerolled() throws Exception {
        JsonNode first = start(user, "fr", "B1", 201);
        JsonNode again = start(user, "fr", "C2", 201);
        assertThat(again.get("id").asLong()).isEqualTo(first.get("id").asLong());
        assertThat(again.get("prompt").asString()).isEqualTo(first.get("prompt").asString());
        assertThat(again.get("level").asString()).isEqualTo("B1");
        assertThat(start(user, "es", "B1", 201).get("id").asLong()).isNotEqualTo(first.get("id").asLong());
    }

    @Test
    void anExpiredTestCanBeReplacedByANewOne() throws Exception {
        long first = start(user, "de", "A1", 201).get("id").asLong();
        CLOCK.advance(Duration.ofMinutes(6));
        assertThat(start(user, "de", "A1", 201).get("id").asLong()).isNotEqualTo(first);
        assertThat(api.get(user, "/api/writing/tests/" + first, 200).get("status").asString()).isEqualTo("expired");
    }

    @Test
    void rejectsUnknownLevelsAndFreeAccounts() throws Exception {
        start(user, "fr", "D1", 400);
        start(api.signup(), "fr", "B1", 402);
    }

    // ---- submitting ----

    @Test
    void cannotHandInEarlyBelowTheMinimum() throws Exception {
        long id = start(user, "fr", "B1", 201).get("id").asLong();
        JsonNode error = submit(user, id, words(59), 400);
        assertThat(error.get("message").asString()).contains("60");
        assertThat(api.get(user, "/api/writing/tests/" + id, 200).get("status").asString()).isEqualTo("in_progress");
        submit(user, id, "   ", 400);
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void handingInGradesItWithTheSituationAndMinimumInThePrompt() throws Exception {
        JsonNode t = start(user, "fr", "B1", 201);
        CLOCK.advance(Duration.ofMinutes(3));
        JsonNode graded = submit(user, t.get("id").asLong(), words(64), 200);
        assertThat(graded.get("status").asString()).isEqualTo("graded");
        assertThat(graded.get("wordCount").asInt()).isEqualTo(64);
        assertThat(graded.get("content").asString()).isEqualTo(words(64));
        JsonNode grade = graded.get("grade");
        assertThat(grade.get("score").asInt()).isEqualTo(76);
        assertThat(grade.get("level").asString()).isEqualTo("B1");
        assertThat(grade.get("rubric")).hasSize(4);
        assertThat(grade.get("corrections").get(0).get("corrected").asString()).isEqualTo("je suis allée");
        String request = AI.requests().getFirst();
        assertThat(request).contains("French").contains("60").contains("mot mot");
        assertThat(request).contains(t.get("prompt").asString().substring(0, 20));
    }

    @Test
    void whenTimeRunsOutWhateverIsWrittenIsGradedButShortWorkIsCapped() throws Exception {
        long id = start(user, "fr", "B1", 201).get("id").asLong();
        CLOCK.advance(Duration.ofMinutes(5).plusSeconds(10)); // the browser auto-submits at 0:00; network lag
        JsonNode graded = submit(user, id, words(30), 200);
        assertThat(graded.get("wordCount").asInt()).isEqualTo(30);
        assertThat(graded.get("grade").get("score").asInt()).isEqualTo(50); // 30 of 60 words: at most 50
    }

    @Test
    void afterTheGracePeriodTheTestIsClosed() throws Exception {
        long id = start(user, "fr", "B1", 201).get("id").asLong();
        CLOCK.advance(Duration.ofMinutes(5).plusSeconds(31));
        submit(user, id, words(80), 409);
        assertThat(api.get(user, "/api/writing/tests/" + id, 200).get("status").asString()).isEqualTo("expired");
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void aTestCanOnlyBeHandedInOnce() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        submit(user, id, words(30), 200);
        submit(user, id, words(40), 409);
    }

    @Test
    void otherPeoplesTestsAreInvisible() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        String other = api.signupPro();
        api.get(other, "/api/writing/tests/" + id, 404);
        submit(other, id, words(30), 404);
    }

    // ---- grading failures ----

    @Test
    void whenGradingFailsTheWritingIsKeptAndCanBeGradedLater() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        AI.setFailing(true);
        JsonNode saved = submit(user, id, words(30), 200);
        assertThat(saved.get("status").asString()).isEqualTo("ungraded");
        assertThat(saved.get("gradeError").asString()).isNotBlank();
        assertThat(saved.get("content").asString()).isEqualTo(words(30));

        AI.setFailing(false);
        CLOCK.advance(Duration.ofHours(1)); // regrading isn't bound by the time limit
        JsonNode graded = api.post(user, "/api/writing/tests/" + id + "/grade", "{}", 200);
        assertThat(graded.get("status").asString()).isEqualTo("graded");
        assertThat(graded.has("gradeError")).isFalse();
        api.post(user, "/api/writing/tests/" + id + "/grade", "{}", 409);
    }

    @Test
    void aTestStillInProgressCannotBeGraded() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        api.post(user, "/api/writing/tests/" + id + "/grade", "{}", 409);
    }

    // ---- writing situations stay a fixed bank shared by everyone ----

    @Test
    void everyUserDrawsSituationsFromTheSameBankWithoutAskingTheAi() throws Exception {
        var bank = PromptBank.load().forLevel("B1").stream().map(PromptBank.Prompt::situation).toList();
        String first = start(user, "fr", "B1", 201).get("prompt").asString();
        String second = start(api.signupPro(), "fr", "B1", 201).get("prompt").asString();
        assertThat(bank).contains(first, second);
        assertThat(AI.requests()).isEmpty();
    }

    // ---- consistent grading ----

    @Test
    void gradingAsksForDeterministicOutputFromTheConfiguredModel() throws Exception {
        submit(user, start(user, "fr", "A1", 201).get("id").asLong(), words(30), 200);
        JsonNode request = json.readTree(AI.requests().getFirst());
        assertThat(request.get("temperature").asDouble()).isZero();
        assertThat(request.get("model").asString()).isEqualTo("test-model");
    }

    @Test
    void aGradedTestRecordsWhatGradedIt() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        JsonNode graded = submit(user, id, words(30), 200);
        assertThat(graded.get("gradeModel").asString()).isEqualTo("test-model");
        assertThat(graded.get("gradePromptVersion").asString()).isEqualTo(app.lector.ai.WritingGrader.PROMPT_VERSION);
        JsonNode later = api.get(user, "/api/writing/tests/" + id, 200);
        assertThat(later.get("gradeModel").asString()).isEqualTo("test-model");
        assertThat(later.get("grade").get("score").asInt()).isEqualTo(76);
    }

    @Test
    void anUngradedTestRecordsNoGrader() throws Exception {
        AI.setFailing(true);
        JsonNode saved = submit(user, start(user, "fr", "A1", 201).get("id").asLong(), words(30), 200);
        assertThat(saved.has("gradeModel")).isFalse();
        assertThat(saved.has("gradePromptVersion")).isFalse();
    }

    @Test
    void gradesFromTheAiAreKeptInBounds() throws Exception {
        AI.reply("""
                {"score": 140, "level": "Z9", "rubric": {"task": {"score": 5}, "grammar": {"score": 9},
                 "vocabulary": {"score": 5}, "coherence": {"score": 5}}}
                """);
        JsonNode grade = submit(user, start(user, "fr", "A1", 201).get("id").asLong(), words(30), 200).get("grade");
        assertThat(grade.get("score").asInt()).isEqualTo(100);
        assertThat(grade.get("rubric").get(1).get("score").asInt()).isEqualTo(5);
        assertThat(grade.path("level").isNull() || grade.path("level").isMissingNode()).isTrue();
    }

    // ---- grading failures that keep the writing ----

    @Test
    void aSlowAiServiceTimesOutAndTheWritingIsKept() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        AI.delay(Duration.ofSeconds(4));
        JsonNode saved = submit(user, id, words(30), 200);
        assertThat(saved.get("status").asString()).isEqualTo("ungraded");
        assertThat(saved.get("gradeError").asString()).isEqualTo("The AI service is unavailable right now");
        assertThat(saved.get("content").asString()).isEqualTo(words(30));
        assertThat(saved.has("grade")).isFalse();
    }

    @Test
    void anUnreadableAiAnswerKeepsTheWriting() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        AI.replyRaw("Sure! Here is the grade: great job");
        JsonNode saved = submit(user, id, words(30), 200);
        assertThat(saved.get("status").asString()).isEqualTo("ungraded");
        assertThat(saved.get("gradeError").asString()).isEqualTo("The AI service returned an unreadable answer");
        assertThat(saved.has("grade")).isFalse();
    }

    @Test
    void anAiOutageMessageIsShownWithTheWriting() throws Exception {
        long id = start(user, "fr", "A1", 201).get("id").asLong();
        AI.setFailing(true);
        JsonNode saved = submit(user, id, words(30), 200);
        assertThat(saved.get("gradeError").asString()).isEqualTo("The AI service is unavailable right now");
    }

    // ---- history ----

    @Test
    void historyListsTestsInTheLanguageNewestFirst() throws Exception {
        String learner = api.signupPro();
        long a = start(learner, "it", "A1", 201).get("id").asLong();
        submit(learner, a, words(30), 200);
        CLOCK.advance(Duration.ofSeconds(1));
        long b = start(learner, "it", "A2", 201).get("id").asLong();
        start(learner, "es", "A1", 201);

        JsonNode list = api.get(learner, "/api/writing/tests?language=it", 200);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("id").asLong()).isEqualTo(b);
        assertThat(list.get(1).get("id").asLong()).isEqualTo(a);
        assertThat(list.get(1).get("grade").get("score").asInt()).isEqualTo(76);
    }
}
