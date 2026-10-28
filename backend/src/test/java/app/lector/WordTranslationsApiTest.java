package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.MachineTranslationRepository;
import app.lector.translation.TranslateStub;
import app.lector.translation.TranslationUsageRepository;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=translations",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.translation.enabled=true",
        "app.translation.region=eu-west-1",
        "app.translation.timeout=1s",
        "app.translation.monthly-character-cap=1000"
})
@AutoConfigureMockMvc
@Import(TestClock.Config.class)
@ExtendWith(TestClock.class)
class WordTranslationsApiTest {

    private static final TranslateStub TRANSLATE;

    static {
        try {
            TRANSLATE = new TranslateStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        System.setProperty("aws.accessKeyId", "test");
        System.setProperty("aws.secretAccessKey", "test");
    }

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.translation.endpoint", TRANSLATE::endpoint);
    }

    @AfterAll
    static void stop() {
        TRANSLATE.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    MachineTranslationRepository stored;

    @Autowired
    TranslationUsageRepository usage;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
        TRANSLATE.reset();
        usage.deleteAll();
    }

    private static String fresh() {
        StringBuilder s = new StringBuilder("w");
        for (int i = 0; i < 9; i++) {
            s.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        }
        return s.toString();
    }

    private String learner(String nativeLanguage) throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"" + nativeLanguage + "\"}", 200);
        return token;
    }

    private void saveMeaning(String nativeLanguage, String term, String meaning) throws Exception {
        api.post(learner(nativeLanguage), "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term
                + "\",\"meaning\":\"" + meaning + "\"}", 201);
    }

    private JsonNode lookup(String token, String term) throws Exception {
        return lookup(token, term, 200);
    }

    private JsonNode lookup(String token, String term, int status) throws Exception {
        return api.send(get("/api/dictionary").param("language", "fr").param("term", term).param("bare", "true"),
                token, status);
    }

    private static List<String> meanings(JsonNode result) {
        return result.path("meanings").valueStream().map(JsonNode::asString).toList();
    }

    @Test
    void withTheAiTurnedOffTheReaderShowsOnlyOtherLearnersMeaningsAndAmazonIsNotAsked() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", "house");
        JsonNode alone = api.send(get("/api/dictionary").param("language", "fr").param("term", word)
                .param("before", "La ").param("after", " est grande."), learner("en"), 200);
        assertThat(meanings(alone)).isEmpty();
        assertThat(alone.get("source").isNull()).isTrue();
        assertThat(api.send(get("/api/dictionary").param("language", "fr").param("term", word), learner("en"), 200)
                .path("meanings").isEmpty()).isTrue();
        assertThat(TRANSLATE.requests()).isEmpty();
        saveMeaning("en", word, "home");
        saveMeaning("en", word, "home");
        assertThat(meanings(api.send(get("/api/dictionary").param("language", "fr").param("term", word)
                .param("before", "La ").param("after", " est grande."), learner("en"), 200))).containsExactly("home");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void anEnglishSpeakerGetsAMachineTranslation() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", "house");
        JsonNode result = lookup(learner("en"), word);
        assertThat(meanings(result)).containsExactly("house");
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(result.get("source").asString()).isEqualTo("machine");
        assertThat(result.get("term").asString()).isEqualTo(word);
        assertThat(result.get("language").asString()).isEqualTo("fr");
        assertThat(TRANSLATE.requests()).containsExactly(new TranslateStub.Request(word, "fr", "en"));
    }

    @Test
    void aSpanishSpeakerGetsOneToo() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "es", "casa");
        JsonNode result = lookup(learner("es"), word);
        assertThat(meanings(result)).containsExactly("casa");
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("es");
        assertThat(TRANSLATE.requests()).containsExactly(new TranslateStub.Request(word, "fr", "es"));
    }

    @Test
    void meaningsOtherLearnersSavedComeFirst() throws Exception {
        String word = fresh();
        for (int i = 0; i < 3; i++) {
            saveMeaning("en", word, "home");
        }
        saveMeaning("en", word, "house");
        saveMeaning("en", word, "house");
        JsonNode result = lookup(learner("en"), word);
        assertThat(meanings(result)).containsExactly("home", "house");
        assertThat(result.get("source").asString()).isEqualTo("community");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void communityMeaningsTakeOverFromAStoredMachineTranslation() throws Exception {
        String word = fresh();
        assertThat(meanings(lookup(learner("en"), word))).containsExactly("[en] " + word);
        saveMeaning("en", word, "home");
        saveMeaning("en", word, "home");
        JsonNode result = lookup(learner("en"), word);
        assertThat(meanings(result)).containsExactly("home");
        assertThat(result.get("source").asString()).isEqualTo("community");
    }

    @Test
    void readingMyOwnLanguageHasNoMeaningLine() throws Exception {
        JsonNode result = lookup(learner("fr"), fresh());
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("meaningLanguage").isNull()).isTrue();
        assertThat(result.get("source").isNull()).isTrue();
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void phrasesGetAMeaningToo() throws Exception {
        String phrase = "tout " + fresh();
        TRANSLATE.answer(phrase, "en", "quite");
        assertThat(meanings(lookup(learner("en"), phrase))).containsExactly("quite");
        assertThat(meanings(lookup(learner("en"), phrase))).containsExactly("quite");
        assertThat(TRANSLATE.requests()).hasSize(1);
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, phrase)).isPresent();
    }

    @Test
    void aWordIsSentAsWrittenAndStoredByItsKey() throws Exception {
        String word = fresh();
        String written = Character.toUpperCase(word.charAt(0)) + word.substring(1);
        lookup(learner("en"), written);
        assertThat(TRANSLATE.requests()).containsExactly(new TranslateStub.Request(written, "fr", "en"));
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word)).isPresent();
        assertThat(lookup(learner("en"), word).get("term").asString()).isEqualTo(word);
    }

    @Test
    void aBlankOrOverlongTermIsRefused() throws Exception {
        String token = learner("en");
        lookup(token, "  ", 400);
        lookup(token, "a".repeat(201), 400);
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void laterLookupsReuseTheStoredAnswer() throws Exception {
        String word = fresh();
        lookup(learner("en"), word);
        lookup(learner("en"), word);
        lookup(learner("en"), word.toUpperCase());
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void aStoredAnswerFromAnEarlierRunIsUsed() throws Exception {
        String word = fresh();
        stored.insertIfAbsent("FR", "EN", word, "stored", Instant.now());
        assertThat(meanings(lookup(learner("en"), word))).containsExactly("stored");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void anotherNativeLanguageAsksAgain() throws Exception {
        String word = fresh();
        lookup(learner("en"), word);
        assertThat(meanings(lookup(learner("es"), word))).containsExactly("[es] " + word);
        assertThat(TRANSLATE.requests()).extracting(TranslateStub.Request::target).containsExactly("en", "es");
    }

    @Test
    void aTranslationThatIsJustTheWordIsNotShownAndNotAskedAgain() throws Exception {
        String word = fresh();
        TRANSLATE.echo(true);
        JsonNode result = lookup(learner("en"), word);
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("en");
        lookup(learner("en"), word);
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void twoLookupsAtOnceStoreOneAnswer() throws Exception {
        String word = fresh();
        TRANSLATE.delay(300);
        String a = learner("en");
        String b = learner("en");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<JsonNode>> both = pool.invokeAll(List.<Callable<JsonNode>>of(() -> lookup(a, word),
                    () -> lookup(b, word)));
            for (Future<JsonNode> f : both) {
                assertThat(meanings(f.get())).containsExactly("[en] " + word);
            }
        } finally {
            pool.shutdown();
        }
        assertThat(stored.countBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word))
                .isEqualTo(1);
    }

    @Test
    void whenAmazonFailsNothingIsStoredAndTheNextLookupTriesAgain() throws Exception {
        String word = fresh();
        TRANSLATE.failing(true);
        JsonNode result = lookup(learner("en"), word);
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word)).isEmpty();
        TRANSLATE.failing(false);
        assertThat(meanings(lookup(learner("en"), word))).containsExactly("[en] " + word);
    }

    @Test
    void aSlowAnswerIsGivenUpOn() throws Exception {
        String word = fresh();
        TRANSLATE.delay(2500);
        long start = System.nanoTime();
        JsonNode result = lookup(learner("en"), word);
        assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(2400);
        assertThat(meanings(result)).isEmpty();
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word)).isEmpty();
    }

    @Test
    void theMonthlyCapStopsNewRequestsButStoredAnswersStillShow() throws Exception {
        String known = fresh();
        lookup(learner("en"), known);
        usage.deleteAll();
        usage.add("2026-10", 995, 1000);
        JsonNode capped = lookup(learner("en"), fresh());
        assertThat(meanings(capped)).isEmpty();
        assertThat(capped.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(meanings(lookup(learner("en"), known))).containsExactly("[en] " + known);
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void charactersSentAreCountedPerMonth() throws Exception {
        String word = fresh();
        lookup(learner("en"), word);
        assertThat(usage.findById("2026-10")).hasValueSatisfying(u -> assertThat(u.getCharacters())
                .isEqualTo(word.length()));
    }

    @Test
    void theCapResetsOnTheFirstOfTheMonth() throws Exception {
        usage.add("2026-10", 1000, 1000);
        String word = fresh();
        assertThat(meanings(lookup(learner("en"), word))).isEmpty();
        TestClock.CLOCK.set(Instant.parse("2026-11-01T00:00:01Z"));
        assertThat(meanings(lookup(learner("en"), word))).containsExactly("[en] " + word);
    }
}
