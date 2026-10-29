package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import app.lector.dictionary.SentenceMeaningRepository;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.writing.OpenAiStub;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=map-word-meanings",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.openai.api-key=test-key",
        "app.openai.daily-limit=0",
        "app.openai.meaning-timeout=1s",
        "app.translation.enabled=true",
        "app.translation.monthly-character-cap=1000"
})
@AutoConfigureMockMvc
class MapWordMeaningApiTest {

    private static final OpenAiStub AI;

    static {
        try {
            AI = new OpenAiStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

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
    SentenceMeaningRepository stored;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
        AI.reset();
    }

    private static String fresh() {
        StringBuilder s = new StringBuilder("w");
        for (int i = 0; i < 9; i++) {
            s.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        }
        return s.toString();
    }

    private static String meaning(String m) {
        return "{\"meaning\":\"" + m + "\"}";
    }

    private String learner(String nativeLanguage) throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"" + nativeLanguage + "\"}", 200);
        return token;
    }

    private JsonNode onTheMap(String token, String term) throws Exception {
        return api.send(get("/api/dictionary").param("language", "fr").param("term", term).param("bare", "true"),
                token, 200);
    }

    private JsonNode onTheMap(String term) throws Exception {
        return onTheMap(learner("pl"), term);
    }

    private JsonNode inTheReader(String term, String before, String after) throws Exception {
        return api.send(get("/api/dictionary").param("language", "fr").param("term", term).param("before", before)
                .param("after", after), learner("pl"), 200);
    }

    private static List<String> meanings(JsonNode result) {
        return result.path("meanings").valueStream().map(JsonNode::asString).toList();
    }

    private long storedFor(String word) {
        return stored.countBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.PL, word);
    }

    private void saveMeaning(String term, String meaning) throws Exception {
        api.post(learner("pl"), "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term
                + "\",\"meaning\":\"" + meaning + "\"}", 201);
    }

    @Test
    void aWordNobodyHasAMeaningForIsAskedOfTheAiOnItsOwn() throws Exception {
        String word = fresh();
        AI.reply(meaning("bank, ławka"));
        JsonNode result = onTheMap(word);
        assertThat(meanings(result)).containsExactly("bank, ławka");
        assertThat(result.get("source").asString()).isEqualTo("sentence");
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("pl");
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().getFirst()).contains("\"content\":\"" + word + "\"")
                .doesNotContain("<b>" + word + "</b>");
    }

    @Test
    void theAiIsAskedForTheWordsMostCommonMeaningsInMyLanguage() throws Exception {
        AI.reply(meaning("bank, ławka"));
        onTheMap(fresh());
        assertThat(AI.requests().getFirst()).contains("most common meanings").contains("most common first")
                .contains("Polish").contains("French");
    }

    @Test
    void itDoesNotUseTheDailyAiAllowance() throws Exception {
        AI.reply(meaning("bank, ławka"));
        String token = learner("pl");
        for (int i = 0; i < 3; i++) {
            assertThat(meanings(onTheMap(token, fresh()))).containsExactly("bank, ławka");
        }
    }

    @Test
    void theAnswerIsSavedAndReusedForEveryoneWithTheSameLanguage() throws Exception {
        String word = fresh();
        AI.reply(meaning("bank, ławka"));
        onTheMap(word);
        AI.reset();
        assertThat(meanings(onTheMap(word))).containsExactly("bank, ławka");
        assertThat(meanings(onTheMap(word.toUpperCase()))).containsExactly("bank, ławka");
        assertThat(AI.requests()).isEmpty();
        assertThat(storedFor(word)).isEqualTo(1);
    }

    @Test
    void anotherOwnLanguageAsksAgain() throws Exception {
        String word = fresh();
        AI.reply(meaning("bank, ławka"));
        onTheMap(word);
        AI.reply(meaning("bank, bench"));
        assertThat(meanings(onTheMap(learner("en"), word))).containsExactly("bank, bench");
        assertThat(AI.requests()).hasSize(2);
    }

    @Test
    void sharedMeaningsComeFirstAndTheAiIsNotAsked() throws Exception {
        String word = fresh();
        saveMeaning(word, "jabłko");
        saveMeaning(word, "jabłko");
        JsonNode result = onTheMap(word);
        assertThat(meanings(result)).containsExactly("jabłko");
        assertThat(result.get("source").asString()).isEqualTo("community");
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void aWordOnItsOwnMeaningIsNotUsedInTheReader() throws Exception {
        String word = fresh();
        AI.reply(meaning("bank, ławka"));
        onTheMap(word);
        AI.reset();
        AI.reply(meaning("ławka"));
        assertThat(meanings(inTheReader(word, "Il est assis sur le ", " du parc."))).containsExactly("ławka");
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().getFirst()).contains("Il est assis sur le <b>" + word + "</b> du parc.");
    }

    @Test
    void aReaderMeaningIsNotUsedOnTheMap() throws Exception {
        String word = fresh();
        AI.reply(meaning("ławka"));
        inTheReader(word, "Il est assis sur le ", " du parc.");
        AI.reset();
        AI.reply(meaning("bank, ławka"));
        assertThat(meanings(onTheMap(word))).containsExactly("bank, ławka");
        assertThat(AI.requests()).hasSize(1);
    }

    @Test
    void whenTheAiFailsThereIsNoMeaningNothingIsSavedAndTheNextClickAsksAgain() throws Exception {
        String word = fresh();
        AI.setFailing(true);
        JsonNode result = onTheMap(word);
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("source").isNull()).isTrue();
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("pl");
        assertThat(storedFor(word)).isZero();
        AI.setFailing(false);
        AI.reply(meaning("bank, ławka"));
        assertThat(meanings(onTheMap(word))).containsExactly("bank, ławka");
    }

    @Test
    void anUnusableAnswerGivesNoMeaningAndIsNotSaved() throws Exception {
        String word = fresh();
        for (String answer : List.of(meaning(""), "{}", "{\"meaning\":42}", meaning("x".repeat(101)))) {
            AI.reset();
            AI.reply(answer);
            assertThat(meanings(onTheMap(word))).as(answer).isEmpty();
        }
        assertThat(storedFor(word)).isZero();
    }

    @Test
    void aWordInMyOwnLanguageAsksNobody() throws Exception {
        JsonNode result = onTheMap(learner("fr"), fresh());
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("meaningLanguage").isNull()).isTrue();
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void aBlankOrOverlongTermIsRefused() throws Exception {
        String token = learner("pl");
        api.send(get("/api/dictionary").param("language", "fr").param("term", "  ").param("bare", "true"), token, 400);
        api.send(get("/api/dictionary").param("language", "fr").param("term", "a".repeat(201)).param("bare", "true"),
                token, 400);
        assertThat(AI.requests()).isEmpty();
    }
}
