package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.dictionary.DictionaryStub;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.MachineTranslationRepository;
import app.lector.translation.TranslateStub;
import app.lector.translation.TranslationUsageRepository;
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

/**
 * word-translations.feature: what the word popup's lookup gives as the meaning in the learner's own language, from
 * community meanings, Wiktionary's tables and machine translation. Its own setup: machine translation switched on
 * against {@link TranslateStub}, the dictionaries answered by {@link DictionaryStub}, and a movable clock for the
 * monthly cap.
 */
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
    private static final DictionaryStub DICTIONARY;

    static {
        try {
            TRANSLATE = new TranslateStub();
            DICTIONARY = new DictionaryStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        // The SDK's default credential chain reads these; the stub doesn't check signatures.
        System.setProperty("aws.accessKeyId", "test");
        System.setProperty("aws.secretAccessKey", "test");
    }

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.translation.endpoint", TRANSLATE::endpoint);
        registry.add("app.dictionary.free-dictionary-base-url", DICTIONARY::freeDictionaryUrl);
        registry.add("app.dictionary.wiktionary-base-url", DICTIONARY::wiktionaryUrl);
    }

    @AfterAll
    static void stop() {
        TRANSLATE.close();
        DICTIONARY.close();
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

    /** A made-up word nobody has looked up yet (lookups are cached, and stored translations are shared). */
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
        api.post(learner(nativeLanguage), "/api/vocabulary", "{\"language\":\"de\",\"term\":\"" + term
                + "\",\"meaning\":\"" + meaning + "\"}", 201);
    }

    private JsonNode lookup(String token, String term) throws Exception {
        return api.get(token, "/api/dictionary?language=de&term=" + term, 200);
    }

    private static List<String> translations(JsonNode result) {
        return result.path("translations").valueStream().map(JsonNode::asString).toList();
    }

    // --- Community meanings ---

    @Test
    void meaningsOtherLearnersSavedComeFirst() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "dog");
        for (int i = 0; i < 3; i++) {
            saveMeaning("es", word, "perro");
        }
        saveMeaning("es", word, "can");
        saveMeaning("es", word, "can");
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).containsExactly("perro", "can");
        assertThat(result.get("translationLanguage").asString()).isEqualTo("es");
        assertThat(result.get("translationSource").asString()).isEqualTo("community");
        assertThat(result.get("found").asBoolean()).isTrue();
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void communityMeaningsShowForAWordNoDictionaryHas() throws Exception {
        String word = fresh();
        saveMeaning("es", word, "nevera");
        saveMeaning("es", word, "nevera");
        JsonNode result = lookup(learner("es"), word);
        assertThat(result.get("found").asBoolean()).isFalse();
        assertThat(translations(result)).containsExactly("nevera");
        assertThat(result.get("translationSource").asString()).isEqualTo("community");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void communityMeaningsTakeOverFromAStoredMachineTranslation() throws Exception {
        String word = fresh();
        assertThat(translations(lookup(learner("es"), word))).containsExactly("[es] " + word);
        saveMeaning("es", word, "nevera");
        saveMeaning("es", word, "nevera");
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).containsExactly("nevera");
        assertThat(result.get("translationSource").asString()).isEqualTo("community");
    }

    // --- Wiktionary's tables ---

    @Test
    void wiktionarysTranslationsNeedNoMachineTranslation() throws Exception {
        String word = fresh();
        String pivot = fresh();
        DICTIONARY.define("de", word, pivot);
        DICTIONARY.translations(pivot, "de", word, "es", "perro", "es", "can");
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).containsExactly("perro", "can");
        assertThat(result.get("translationSource").asString()).isEqualTo("dictionary");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    // --- Machine translation ---

    @Test
    void theFirstLookupAsksAmazonOnceAndStoresTheAnswer() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "fridge");
        TRANSLATE.answer(word, "es", "refrigerador");
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).containsExactly("refrigerador");
        assertThat(result.get("translationSource").asString()).isEqualTo("machine");
        assertThat(result.get("senses").get(0).get("definition").asString()).isEqualTo("fridge");
        assertThat(TRANSLATE.requests()).containsExactly(new TranslateStub.Request(word, "de", "es"));
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.DE, NativeLanguage.ES, word))
                .hasValueSatisfying(t -> assertThat(t.getTranslation()).isEqualTo("refrigerador"));
    }

    @Test
    void aWordNoDictionaryHasStillGetsAMachineTranslation() throws Exception {
        String word = fresh();
        JsonNode result = lookup(learner("es"), word);
        assertThat(result.get("found").asBoolean()).isFalse();
        assertThat(translations(result)).containsExactly("[es] " + word);
        assertThat(result.get("translationSource").asString()).isEqualTo("machine");
    }

    @Test
    void laterLookupsReuseTheStoredAnswer() throws Exception {
        String word = fresh();
        lookup(learner("es"), word);
        lookup(learner("es"), word);
        lookup(learner("es"), word.toUpperCase());
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void aStoredAnswerFromAnEarlierRunIsUsed() throws Exception {
        String word = fresh();
        stored.insertIfAbsent("DE", "ES", word, "guardado", Instant.now());
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).containsExactly("guardado");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void anotherNativeLanguageAsksAgain() throws Exception {
        String word = fresh();
        lookup(learner("es"), word);
        JsonNode french = lookup(learner("fr"), word);
        assertThat(translations(french)).containsExactly("[fr] " + word);
        assertThat(TRANSLATE.requests()).extracting(TranslateStub.Request::target).containsExactly("es", "fr");
    }

    @Test
    void aTranslationThatIsJustTheWordIsNotShownAndNotAskedAgain() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "a name");
        TRANSLATE.echo(true);
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).isEmpty();
        assertThat(result.get("translationLanguage").asString()).isEqualTo("es");
        lookup(learner("es"), word);
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void englishSpeakersAndSameLanguageLearnersAreUnchanged() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "dog");
        JsonNode english = lookup(learner("en"), word);
        assertThat(english.has("translations")).isFalse();
        JsonNode german = lookup(learner("de"), word);
        assertThat(german.has("translations")).isFalse();
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void twoLookupsAtOnceStoreOneAnswer() throws Exception {
        String word = fresh();
        TRANSLATE.delay(300);
        String a = learner("es");
        String b = learner("es");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<JsonNode>> both = pool.invokeAll(List.<Callable<JsonNode>>of(() -> lookup(a, word),
                    () -> lookup(b, word)));
            for (Future<JsonNode> f : both) {
                assertThat(translations(f.get())).containsExactly("[es] " + word);
            }
        } finally {
            pool.shutdown();
        }
        assertThat(stored.countBySourceLanguageAndTargetLanguageAndTerm(Language.DE, NativeLanguage.ES, word))
                .isEqualTo(1);
    }

    // --- Failures and limits ---

    @Test
    void whenAmazonFailsNothingIsStoredAndTheNextLookupTriesAgain() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "fridge");
        TRANSLATE.failing(true);
        JsonNode result = lookup(learner("es"), word);
        assertThat(translations(result)).isEmpty();
        assertThat(result.get("translationLanguage").asString()).isEqualTo("es");
        assertThat(result.get("senses").get(0).get("definition").asString()).isEqualTo("fridge");
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.DE, NativeLanguage.ES, word)).isEmpty();
        TRANSLATE.failing(false);
        assertThat(translations(lookup(learner("es"), word))).containsExactly("[es] " + word);
    }

    @Test
    void aSlowAnswerIsGivenUpOn() throws Exception {
        String word = fresh();
        DICTIONARY.define("de", word, "fridge");
        TRANSLATE.delay(2500);
        long start = System.nanoTime();
        JsonNode result = lookup(learner("es"), word);
        assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(2400);
        assertThat(translations(result)).isEmpty();
        assertThat(stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.DE, NativeLanguage.ES, word)).isEmpty();
    }

    @Test
    void theMonthlyCapStopsNewRequestsButStoredAnswersStillShow() throws Exception {
        String known = fresh();
        lookup(learner("es"), known);
        usage.deleteAll();
        usage.add("2026-10", 995, 1000);
        String word = fresh();
        DICTIONARY.define("de", word, "fridge");
        JsonNode capped = lookup(learner("es"), word);
        assertThat(translations(capped)).isEmpty();
        assertThat(capped.get("senses").get(0).get("definition").asString()).isEqualTo("fridge");
        assertThat(translations(lookup(learner("es"), known))).containsExactly("[es] " + known);
        assertThat(TRANSLATE.requests()).hasSize(1);
    }

    @Test
    void charactersSentAreCountedPerMonth() throws Exception {
        String word = fresh();
        lookup(learner("es"), word);
        assertThat(usage.findById("2026-10")).hasValueSatisfying(u -> assertThat(u.getCharacters())
                .isEqualTo(word.length()));
    }

    @Test
    void theCapResetsOnTheFirstOfTheMonth() throws Exception {
        usage.add("2026-10", 1000, 1000);
        String word = fresh();
        assertThat(translations(lookup(learner("es"), word))).isEmpty();
        TestClock.CLOCK.set(Instant.parse("2026-11-01T00:00:01Z"));
        assertThat(translations(lookup(learner("es"), word))).containsExactly("[es] " + word);
    }
}
