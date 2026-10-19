package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class BaseWordsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;
    private String user;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        user = api.signup();
    }

    private JsonNode save(String language, String term, String status, String lemma) throws Exception {
        String lemmaField = lemma == null ? "" : ",\"lemma\":\"" + lemma + "\"";
        String statusField = status == null ? "" : ",\"status\":\"" + status + "\"";
        return api.post(user, "/api/vocabulary",
                "{\"language\":\"" + language + "\",\"term\":\"" + term + "\"" + statusField + lemmaField + "}", 201);
    }

    private JsonNode known(String term, String lemma) throws Exception {
        return save("fr", term, "known", lemma);
    }

    private JsonNode header(String query) throws Exception {
        return api.get(user, "/api/dashboard/header" + query, 200);
    }

    private long baseWords(String query) throws Exception {
        return header(query).get("knownBaseWords").asLong();
    }

    private long forms(String query) throws Exception {
        return header(query).get("knownWords").asLong();
    }

    @Test
    void aSavedWordKeepsTheBaseWordItWasSavedWith() throws Exception {
        assertThat(known("parlons", "parler").get("lemma").asString()).isEqualTo("parler");
    }

    @Test
    void theBaseWordIsStoredInTheSameFormAsTerms() throws Exception {
        assertThat(known("Belles", "  Beau ").get("lemma").asString()).isEqualTo("beau");
    }

    @Test
    void aWordSavedWithoutABaseWordHasNone() throws Exception {
        assertThat(known("sifflotons", null).has("lemma")).isFalse();
    }

    @Test
    void aLaterLookupFillsInAMissingBaseWordButDoesNotReplaceOne() throws Exception {
        known("sifflotons", null);
        assertThat(save("fr", "sifflotons", null, "siffloter").get("lemma").asString()).isEqualTo("siffloter");
        assertThat(save("fr", "sifflotons", null, "autre").get("lemma").asString()).isEqualTo("siffloter");
        assertThat(save("fr", "sifflotons", null, null).get("status").asString()).isEqualTo("known");
    }

    @Test
    void aBlankBaseWordIsIgnored() throws Exception {
        assertThat(known("parlons", "  ").has("lemma")).isFalse();
    }

    @Test
    void formsOfOneBaseWordCountOnceAsBaseWords() throws Exception {
        known("parle", "parler");
        known("parlons", "parler");
        known("parlé", "parler");
        known("beau", "beau");
        known("belle", "beau");
        known("beaux", "beau");
        assertThat(forms("?language=fr")).isEqualTo(6);
        assertThat(baseWords("?language=fr")).isEqualTo(2);
    }

    @Test
    void aBaseWordCountsWhenAnyFormIsKnownEvenIfTheBaseFormIsNot() throws Exception {
        known("allons", "aller");
        assertThat(baseWords("?language=fr")).isEqualTo(1);
    }

    @Test
    void onlyKnownFormsCount() throws Exception {
        known("parle", "parler");
        save("fr", "parlons", "learning", "parler");
        save("fr", "parlez", "ignored", "parler");
        save("fr", "zorbons", "learning", "zorber");
        assertThat(forms("?language=fr")).isEqualTo(1);
        assertThat(baseWords("?language=fr")).isEqualTo(1);
    }

    @Test
    void aWordWithNoBaseWordCountsAsItsOwn() throws Exception {
        known("sifflotons", null);
        known("siffloter", null);
        assertThat(baseWords("?language=fr")).isEqualTo(2);
    }

    @Test
    void aPhraseCountsOnceInBothNumbers() throws Exception {
        known("tout à fait", null);
        assertThat(forms("?language=fr")).isEqualTo(1);
        assertThat(baseWords("?language=fr")).isEqualTo(1);
    }

    @Test
    void theWordListsGroupTheFormsTheyList() throws Exception {
        known("dilemmes", null);
        known("dilemme", null);
        assertThat(baseWords("?language=fr")).isEqualTo(1);
    }

    @Test
    void aBaseWordFromAClickBeatsTheWordLists() throws Exception {
        known("suis", "suivre");
        known("être", null);
        assertThat(baseWords("?language=fr")).isEqualTo(2);
    }

    @Test
    void baseWordsAreCountedPerLanguage() throws Exception {
        known("parle", "parler");
        save("es", "parlo", "known", "parler");
        assertThat(baseWords("?language=fr")).isEqualTo(1);
        assertThat(baseWords("?language=es")).isEqualTo(1);
        assertThat(baseWords("?language=de")).isZero();
        assertThat(baseWords("")).isEqualTo(2);
    }

    @Test
    void otherLearnersWordsAreNotCounted() throws Exception {
        String other = api.signup();
        api.post(other, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"parle\",\"status\":\"known\"}", 201);
        assertThat(baseWords("?language=fr")).isZero();
    }

    @Test
    void theDashboardShowsBothNumbersForEachLanguage() throws Exception {
        known("parle", "parler");
        known("parlons", "parler");
        JsonNode fr = null;
        for (JsonNode l : api.get(user, "/api/dashboard", 200).get("languages")) {
            if (l.get("language").asString().equals("fr")) {
                fr = l;
            }
        }
        assertThat(fr).isNotNull();
        assertThat(fr.get("known").asLong()).isEqualTo(2);
        assertThat(fr.get("knownBase").asLong()).isEqualTo(1);
    }

    @Test
    void aTeacherSeesBothNumbersForEachStudentAndTheClass() throws Exception {
        String teacher = api.signup();
        api.post(teacher, "/api/me/plan", "{\"tier\":\"CLASSROOM\"}", 200);
        JsonNode cls = api.post(teacher, "/api/classes", "{\"name\":\"Classe\",\"language\":\"fr\"}", 201);
        api.post(user, "/api/classes/join", "{\"code\":\"" + cls.get("joinCode").asString() + "\"}", 200);
        known("parle", "parler");
        known("parlons", "parler");
        known("beau", "beau");

        JsonNode progress = api.get(teacher, "/api/classes/" + cls.get("id").asLong() + "/progress", 200);

        JsonNode student = progress.get("students").get(0);
        assertThat(student.get("knownWords").asLong()).isEqualTo(3);
        assertThat(student.get("knownBaseWords").asLong()).isEqualTo(2);
        assertThat(progress.get("averageKnownWords").asDouble()).isEqualTo(3.0);
        assertThat(progress.get("averageKnownBaseWords").asDouble()).isEqualTo(2.0);
    }

    @Test
    void theHoneyJarShowsAllFormsByDefault() throws Exception {
        assertThat(api.get(user, "/api/me", 200).get("honeyJar").asString()).isEqualTo("all_forms");
    }

    @Test
    void theHoneyJarChoiceIsSavedToTheAccount() throws Exception {
        assertThat(api.patch(user, "/api/me", "{\"honeyJar\":\"base_words\"}", 200).get("honeyJar").asString())
                .isEqualTo("base_words");
        assertThat(api.get(user, "/api/me", 200).get("honeyJar").asString()).isEqualTo("base_words");
        api.patch(user, "/api/me", "{\"displayName\":\"Ana\"}", 200);
        assertThat(api.get(user, "/api/me", 200).get("honeyJar").asString()).isEqualTo("base_words");
        api.patch(user, "/api/me", "{\"honeyJar\":\"all_forms\"}", 200);
        assertThat(api.get(user, "/api/me", 200).get("honeyJar").asString()).isEqualTo("all_forms");
    }

    @Test
    void anUnknownHoneyJarChoiceIsRefused() throws Exception {
        api.patch(user, "/api/me", "{\"honeyJar\":\"everything\"}", 400);
        assertThat(api.get(user, "/api/me", 200).get("honeyJar").asString()).isEqualTo("all_forms");
    }
}
