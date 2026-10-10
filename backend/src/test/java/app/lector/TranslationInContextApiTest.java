package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.MachineTranslation;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=translations-in-context",
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
class TranslationInContextApiTest {

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

    private JsonNode lookup(String token, String language, String term, String before, String after) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/dictionary").param("language", language).param("term", term);
        if (before != null) {
            request.param("before", before);
        }
        if (after != null) {
            request.param("after", after);
        }
        return api.send(request, token, 200);
    }

    private JsonNode lookup(String term, String before, String after) throws Exception {
        return lookup(learner("en"), "fr", term, before, after);
    }

    private static List<String> meanings(JsonNode result) {
        return result.path("meanings").valueStream().map(JsonNode::asString).toList();
    }

    private static List<String> sent() {
        return TRANSLATE.requests().stream().map(TranslateStub.Request::text).toList();
    }

    private MachineTranslation row(String word) {
        return stored.findBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word).orElseThrow();
    }

    private void storedAsEchoed(String word) {
        stored.insertIfAbsent("FR", "EN", word, null, Instant.now());
    }

    @Test
    void anEchoedWordIsAskedAgainInsideItsSentence() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        TRANSLATE.answer("Hier, je <b>" + word + "</b> dans la rue.", "en",
                "Yesterday I <b>was limping</b> in the street.");
        JsonNode result = lookup(word, "Hier, je ", " dans la rue.");
        assertThat(meanings(result)).containsExactly("was limping");
        assertThat(result.get("source").asString()).isEqualTo("machine");
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(sent()).containsExactly(word, "Hier, je <b>" + word + "</b> dans la rue.");
        assertThat(row(word).getTranslation()).isEqualTo("was limping");
    }

    @Test
    void theInContextMeaningIsSharedWithOtherSentences() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        TRANSLATE.answer("Je <b>" + word + "</b>.", "en", "I <b>was limping</b>.");
        lookup(word, "Je ", ".");
        TRANSLATE.reset();
        assertThat(meanings(lookup(word, "Tu ", " hier."))).containsExactly("was limping");
        assertThat(meanings(lookup(word, null, null))).containsExactly("was limping");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void aWordAmazonTranslatesOnItsOwnIsAskedOnlyOnce() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", "house");
        assertThat(meanings(lookup(word, "La ", " est grande."))).containsExactly("house");
        assertThat(sent()).containsExactly(word);
    }

    @Test
    void anyLanguagePair() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "fr", word);
        TRANSLATE.answer("Ayer <b>" + word + "</b> por la calle.", "fr", "Hier je <b>boitais</b> dans la rue.");
        JsonNode result = lookup(learner("fr"), "es", word, "Ayer ", " por la calle.");
        assertThat(meanings(result)).containsExactly("boitais");
        assertThat(TRANSLATE.requests()).containsExactly(new TranslateStub.Request(word, "es", "fr"),
                new TranslateStub.Request("Ayer <b>" + word + "</b> por la calle.", "es", "fr"));
    }

    @Test
    void aSelectedPhraseIsAskedAgainTheSameWay() throws Exception {
        String phrase = "bon " + fresh();
        TRANSLATE.answer(phrase, "en", phrase);
        TRANSLATE.answer("Alors <b>" + phrase + "</b> !", "en", "So <b>enjoy your meal</b>!");
        assertThat(meanings(lookup(phrase, "Alors ", " !"))).containsExactly("enjoy your meal");
    }

    @Test
    void theWordIsSentAsWrittenAndStoredByItsKey() throws Exception {
        String word = fresh();
        String written = Character.toUpperCase(word.charAt(0)) + word.substring(1);
        TRANSLATE.answer(written, "en", written);
        TRANSLATE.answer("<b>" + written + "</b>-tu ?", "en", "<b>Were you limping</b>?");
        assertThat(meanings(lookup(written, "", "-tu ?"))).containsExactly("Were you limping");
        assertThat(row(word).getTranslation()).isEqualTo("Were you limping");
    }

    @Test
    void anAnswerWithNoUsableMarkIsStoredAsNoMeaning() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        TRANSLATE.answer("Il <b>" + word + "</b>.", "en", "He " + word + ".");
        JsonNode result = lookup(word, "Il ", ".");
        assertThat(meanings(result)).isEmpty();
        assertThat(result.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(row(word).getTranslation()).isNull();
        assertThat(row(word).isTriedInContext()).isTrue();
        TRANSLATE.reset();
        lookup(word, "Elle ", " encore.");
        lookup(word, null, null);
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void theWordItselfInsideTheMarkIsNoMeaning() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        TRANSLATE.answer("Il <b>" + word + "</b>.", "en", "He <b>" + word.toUpperCase() + "</b>.");
        assertThat(meanings(lookup(word, "Il ", "."))).isEmpty();
        assertThat(row(word).isTriedInContext()).isTrue();
    }

    @Test
    void withNoSentenceTheWordStaysOpenToAnInContextAsk() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        assertThat(meanings(lookup(word, null, null))).isEmpty();
        assertThat(meanings(lookup(word, " ", ""))).isEmpty();
        assertThat(sent()).containsExactly(word);
        assertThat(row(word).isTriedInContext()).isFalse();

        TRANSLATE.reset();
        TRANSLATE.answer("Un <b>" + word + "</b>.", "en", "A <b>bone</b>.");
        assertThat(meanings(lookup(word, "Un ", "."))).containsExactly("bone");
        assertThat(sent()).containsExactly("Un <b>" + word + "</b>.");
    }

    @Test
    void specialCharactersAreSentAsTextAndComeBackPlain() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        TRANSLATE.answer("Tom &amp; Jerry <b>" + word + "</b>.", "en", "Tom & Jerry <b>salt &amp; pepper</b>.");
        assertThat(meanings(lookup(word, "Tom & Jerry ", "."))).containsExactly("salt & pepper");
    }

    @Test
    void whenTheInContextAskFailsTheWordStaysOpen() throws Exception {
        String word = fresh();
        storedAsEchoed(word);
        TRANSLATE.failing(true);
        assertThat(meanings(lookup(word, "Un ", "."))).isEmpty();
        assertThat(row(word).isTriedInContext()).isFalse();
        assertThat(row(word).getTranslation()).isNull();

        TRANSLATE.failing(false);
        TRANSLATE.answer("Un <b>" + word + "</b>.", "en", "A <b>bone</b>.");
        assertThat(meanings(lookup(word, "Un ", "."))).containsExactly("bone");
    }

    @Test
    void aSlowInContextAnswerIsGivenUpOn() throws Exception {
        String word = fresh();
        storedAsEchoed(word);
        TRANSLATE.delay(2500);
        long start = System.nanoTime();
        assertThat(meanings(lookup(word, "Un ", "."))).isEmpty();
        assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(2400);
        assertThat(row(word).isTriedInContext()).isFalse();
    }

    @Test
    void theInContextAskCountsAgainstTheMonthlyCap() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        lookup(word, "Un ", ".");
        int marked = ("Un <b>" + word + "</b>.").length();
        assertThat(usage.findById("2026-10")).hasValueSatisfying(u -> assertThat(u.getCharacters())
                .isEqualTo(word.length() + marked));
    }

    @Test
    void onceTheCapIsReachedTheInContextAskIsNotSentAndTheWordStaysOpen() throws Exception {
        String word = fresh();
        storedAsEchoed(word);
        usage.add("2026-10", 995, 1000);
        assertThat(meanings(lookup(word, "Un ", "."))).isEmpty();
        assertThat(TRANSLATE.requests()).isEmpty();
        assertThat(row(word).isTriedInContext()).isFalse();
    }

    @Test
    void wordsStoredAsEchoedBeforeThisChangeAreAskedInContextOnly() throws Exception {
        String word = fresh();
        storedAsEchoed(word);
        TRANSLATE.answer("Le chien mange un <b>" + word + "</b>.", "en", "The dog eats a <b>bone</b>.");
        assertThat(meanings(lookup(word, "Le chien mange un ", "."))).containsExactly("bone");
        assertThat(sent()).containsExactly("Le chien mange un <b>" + word + "</b>.");
    }

    @Test
    void storedMeaningsAreNotAskedAgainInContext() throws Exception {
        String word = fresh();
        stored.insertIfAbsent("FR", "EN", word, "house", Instant.now());
        assertThat(meanings(lookup(word, "La ", "."))).containsExactly("house");
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void twoInContextAsksAtOnceBothShowAMeaningAndOneIsStored() throws Exception {
        String word = fresh();
        storedAsEchoed(word);
        TRANSLATE.answer("Un <b>" + word + "</b>.", "en", "A <b>bone</b>.");
        TRANSLATE.delay(300);
        String a = learner("en");
        String b = learner("en");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<JsonNode>> both = pool.invokeAll(List.<Callable<JsonNode>>of(
                    () -> lookup(a, "fr", word, "Un ", "."), () -> lookup(b, "fr", word, "Un ", ".")));
            for (Future<JsonNode> f : both) {
                assertThat(meanings(f.get())).containsExactly("bone");
            }
        } finally {
            pool.shutdown();
        }
        assertThat(stored.countBySourceLanguageAndTargetLanguageAndTerm(Language.FR, NativeLanguage.EN, word))
                .isEqualTo(1);
        assertThat(row(word).getTranslation()).isEqualTo("bone");
    }
}
