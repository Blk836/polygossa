package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.TranslationClient;
import app.lector.vocab.CommunityMeanings;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class WordMeaningsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    CommunityMeanings community;

    @Autowired
    TranslationClient translationClient;

    private TestApi api;
    private String word;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
        word = "hund" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private String learner(String nativeLanguage) throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"" + nativeLanguage + "\"}", 200);
        return token;
    }

    private JsonNode save(String token, String language, String term, String meaning) throws Exception {
        String meaningField = meaning == null ? "" : ",\"meaning\":\"" + meaning + "\"";
        return api.post(token, "/api/vocabulary", "{\"language\":\"" + language + "\",\"term\":\"" + term
                + "\",\"definition\":\"perro, can — dog\"" + meaningField + "}", 201);
    }

    @Test
    void savingAWordKeepsItsOwnLanguageMeaningSeparately() throws Exception {
        JsonNode entry = save(learner("es"), "de", word, "perro");
        assertThat(entry.get("meaning").asString()).isEqualTo("perro");
        assertThat(entry.get("meaningLanguage").asString()).isEqualTo("es");
        assertThat(entry.get("definition").asString()).isEqualTo("perro, can — dog");
    }

    @Test
    void theMeaningIsTrimmedAndCut() throws Exception {
        JsonNode entry = save(learner("es"), "de", word, "  " + "p".repeat(300) + " ");
        assertThat(entry.get("meaning").asString()).isEqualTo("p".repeat(200));
    }

    @Test
    void pickingOrEditingAMeaningReplacesIt() throws Exception {
        String ana = learner("es");
        JsonNode entry = save(ana, "de", word, "perro");
        JsonNode edited = api.patch(ana, "/api/vocabulary/" + entry.get("id").asLong(),
                "{\"meaning\":\"perro (animal)\"}", 200);
        assertThat(edited.get("meaning").asString()).isEqualTo("perro (animal)");
        assertThat(save(ana, "de", word, "can").get("meaning").asString()).isEqualTo("can");
    }

    @Test
    void anEditCountsAsTheLearnersOwnMeaning() throws Exception {
        String ana = learner("es");
        long id = save(ana, "de", word, "perro").get("id").asLong();
        save(learner("es"), "de", word, "perro (animal)");
        api.patch(ana, "/api/vocabulary/" + id, "{\"meaning\":\"perro (animal)\"}", 200);
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).containsExactly("perro (animal)");
    }

    @Test
    void clearingTheMeaning() throws Exception {
        String ana = learner("es");
        long id = save(ana, "de", word, "perro").get("id").asLong();
        save(learner("es"), "de", word, "perro");
        JsonNode cleared = api.patch(ana, "/api/vocabulary/" + id, "{\"meaning\":\"  \"}", 200);
        assertThat(cleared.has("meaning")).isFalse();
        assertThat(cleared.has("meaningLanguage")).isFalse();
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).isEmpty();
    }

    @Test
    void leavingTheMeaningOutKeepsIt() throws Exception {
        String ana = learner("es");
        long id = save(ana, "de", word, "perro").get("id").asLong();
        JsonNode entry = api.patch(ana, "/api/vocabulary/" + id, "{\"note\":\"a note\"}", 200);
        assertThat(entry.get("meaning").asString()).isEqualTo("perro");
    }

    @Test
    void wordsSavedWithoutAMeaningCountForNothing() throws Exception {
        save(learner("es"), "de", word, null);
        save(learner("es"), "de", word, null);
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).isEmpty();
    }

    @Test
    void aMeaningOnlyOneLearnerSavedIsNotShown() throws Exception {
        save(learner("es"), "de", word, "perrito lindo");
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).isEmpty();
    }

    @Test
    void theMostCommonMeaningsComeFirstAtMostThree() throws Exception {
        for (String meaning : new String[] {"can", "perro", "perro", "perro", "can", "chucho", "chucho", "pichicho",
                "pichicho", "chucho"}) {
            save(learner("es"), "de", word, meaning);
        }
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).containsExactly("chucho", "perro", "can");
    }

    @Test
    void meaningsDifferingOnlyInCaseCountTogether() throws Exception {
        save(learner("es"), "de", word, "Perro");
        save(learner("es"), "de", word, "perro");
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).hasSize(1);
    }

    @Test
    void otherNativeLanguagesAndLearningLanguagesDontMixIn() throws Exception {
        save(learner("fr"), "de", word, "chien");
        save(learner("fr"), "de", word, "chien");
        save(learner("es"), "fr", word, "perro");
        save(learner("es"), "fr", word, "perro");
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).isEmpty();
        assertThat(community.top(Language.DE, word, NativeLanguage.FR)).containsExactly("chien");
    }

    @Test
    void theMeaningRemembersItsLanguage() throws Exception {
        String ana = learner("es");
        save(ana, "de", word, "perro");
        save(learner("es"), "de", word, "perro");
        api.patch(ana, "/api/me", "{\"nativeLanguage\":\"fr\"}", 200);
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).containsExactly("perro");
        assertThat(community.top(Language.DE, word, NativeLanguage.FR)).isEmpty();
    }

    @Test
    void notesAreNeverCounted() throws Exception {
        for (int i = 0; i < 2; i++) {
            String token = learner("es");
            long id = save(token, "de", word, null).get("id").asLong();
            api.patch(token, "/api/vocabulary/" + id, "{\"note\":\"my secret\"}", 200);
        }
        assertThat(community.top(Language.DE, word, NativeLanguage.ES)).isEmpty();
    }

    @Test
    void machineTranslationIsOffWithoutSettings() {
        assertThat(translationClient.enabled()).isFalse();
        assertThat(translationClient.translate("Hund", "de", "es")).isEmpty();
    }
}
