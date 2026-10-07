package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Characterization of POST /api/vocabulary (create-or-update) with a tiny free-tier word limit. */
@SpringBootTest(properties = {
        "test.database=vocab",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.billing.free-word-limit=2"
})
@AutoConfigureMockMvc
class VocabularySaveTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String token;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
    }

    private JsonNode save(String body, int status) throws Exception {
        return api.post(token, "/api/vocabulary", body, status);
    }

    @Test
    void newEntriesDefaultToLearningAndNormalizeTheTerm() throws Exception {
        JsonNode e = save("{\"language\":\"de\",\"term\":\"  Haus \",\"displayTerm\":\"Haus\"}", 201);
        assertThat(e.get("term").asString()).isEqualTo("haus");
        assertThat(e.get("displayTerm").asString()).isEqualTo("Haus");
        assertThat(e.get("status").asString()).isEqualTo("learning");
        assertThat(e.get("kind").asString()).isEqualTo("word");
        assertThat(e.has("dueAt")).isTrue();
    }

    @Test
    void displayTermDefaultsToTheTermAsTyped() throws Exception {
        JsonNode e = save("{\"language\":\"es\",\"term\":\" Gato \",\"displayTerm\":\"  \"}", 201);
        assertThat(e.get("displayTerm").asString()).isEqualTo("Gato");
    }

    @Test
    void kindIsInferredFromSpacesUnlessGiven() throws Exception {
        assertThat(save("{\"language\":\"es\",\"term\":\"de nada\"}", 201).get("kind").asString()).isEqualTo("phrase");
        assertThat(save("{\"language\":\"es\",\"term\":\"ojalá\",\"kind\":\"phrase\",\"status\":\"known\"}", 201)
                .get("kind").asString()).isEqualTo("phrase");
    }

    @Test
    void blankTermsAreRejected() throws Exception {
        save("{\"language\":\"es\",\"term\":\"   \"}", 400);
    }

    @Test
    void savingAnExistingTermUpdatesStatusAndDetailsInPlace() throws Exception {
        long id = save("{\"language\":\"es\",\"term\":\"gato\",\"contextSentence\":\"Primera.\"}", 201)
                .get("id").asLong();
        JsonNode e = save("{\"language\":\"es\",\"term\":\"GATO\",\"status\":\"known\",\"definition\":\" cat \","
                + "\"partOfSpeech\":\"noun\",\"pronunciation\":\"/ˈɡato/\",\"example\":\"El gato.\","
                + "\"contextSentence\":\"Segunda.\"}", 201);
        assertThat(e.get("id").asLong()).isEqualTo(id);
        assertThat(e.get("status").asString()).isEqualTo("known");
        assertThat(e.get("definition").asString()).isEqualTo("cat");
        assertThat(e.get("partOfSpeech").asString()).isEqualTo("noun");
        assertThat(e.get("pronunciation").asString()).isEqualTo("/ˈɡato/");
        assertThat(e.get("example").asString()).isEqualTo("El gato.");
        assertThat(e.get("contextSentence").asString()).as("first context is kept").isEqualTo("Primera.");
        assertThat(e.has("dueAt")).as("known words are not scheduled").isFalse();
    }

    @Test
    void savingWithoutAStatusLeavesTheStatusAlone() throws Exception {
        save("{\"language\":\"es\",\"term\":\"gato\",\"status\":\"ignored\"}", 201);
        assertThat(save("{\"language\":\"es\",\"term\":\"gato\",\"definition\":\"cat\"}", 201).get("status").asString())
                .isEqualTo("ignored");
    }

    @Test
    void freeLimitAppliesOnlyToLearningWords() throws Exception {
        save("{\"language\":\"es\",\"term\":\"uno\"}", 201);
        save("{\"language\":\"es\",\"term\":\"dos\"}", 201);
        JsonNode err = save("{\"language\":\"es\",\"term\":\"tres\"}", 402);
        assertThat(err.get("code").asString()).isEqualTo("upgrade_required");
        save("{\"language\":\"es\",\"term\":\"tres\",\"status\":\"known\"}", 201);
        save("{\"language\":\"es\",\"term\":\"tres\",\"status\":\"learning\"}", 402);
        save("{\"language\":\"es\",\"term\":\"uno\",\"status\":\"learning\"}", 201);
    }

    @Test
    void termsUpTo500CharactersAreAccepted() throws Exception {
        save("{\"language\":\"es\",\"term\":\"" + "a".repeat(500) + "\",\"status\":\"known\"}", 201);
        save("{\"language\":\"es\",\"term\":\"" + "b".repeat(501) + "\",\"status\":\"known\"}", 400);
    }

    @Test
    void longDisplayTermsAndDetailsAreTruncated() throws Exception {
        JsonNode e = save("{\"language\":\"es\",\"term\":\"x\",\"status\":\"known\",\"displayTerm\":\""
                + "d".repeat(501) + "\",\"definition\":\"" + "q".repeat(4001) + "\",\"example\":\""
                + "e".repeat(2000) + "\"}", 201);
        assertThat(e.get("displayTerm").asString()).hasSize(500);
        assertThat(e.get("definition").asString()).hasSize(4000);
        assertThat(e.get("example").asString()).hasSize(2000);
        JsonNode exact = save("{\"language\":\"es\",\"term\":\"y\",\"status\":\"known\",\"displayTerm\":\""
                + "d".repeat(500) + "\",\"definition\":\"" + "q".repeat(4000) + "\"}", 201);
        assertThat(exact.get("displayTerm").asString()).hasSize(500);
        assertThat(exact.get("definition").asString()).hasSize(4000);
    }

    private Instant updatedAt(String body) throws Exception {
        // The database keeps microseconds; compare at millisecond precision.
        return Instant.parse(save(body, 201).get("updatedAt").asString()).truncatedTo(ChronoUnit.MILLIS);
    }

    @Test
    void updatedAtMovesOnlyWhenSomethingChanges() throws Exception {
        Instant first = updatedAt("{\"language\":\"es\",\"term\":\"gato\"}");
        Thread.sleep(20);
        assertThat(updatedAt("{\"language\":\"es\",\"term\":\"gato\"}")).isEqualTo(first);
        Thread.sleep(20);
        assertThat(updatedAt("{\"language\":\"es\",\"term\":\"gato\",\"definition\":\"cat\"}")).isAfter(first);
    }

    @Test
    void finishingALessonMarksUnseenWordsKnownWithTheirSource() throws Exception {
        long text = api.createText(token, "es", "El gato come.", false);
        save("{\"language\":\"es\",\"term\":\"gato\"}", 201);
        assertThat(api.post(token, "/api/texts/" + text + "/complete", "", 200).get("markedKnown").asInt()).isEqualTo(2);
        JsonNode known = api.get(token, "/api/vocabulary?language=es&status=known&sort=alpha", 200);
        assertThat(known.get("items")).extracting(n -> n.get("term").asString()).containsExactly("come", "el");
        assertThat(known.get("items").get(0).get("sourceText").get("id").asLong()).isEqualTo(text);
    }

    @Test
    void sourceTextIsAttachedOnlyWhenTheUserCanReadIt() throws Exception {
        long mine = api.createText(token, "es", "Hola.", false);
        JsonNode e = save("{\"language\":\"es\",\"term\":\"hola\",\"textId\":" + mine + "}", 201);
        assertThat(e.get("sourceText").get("id").asLong()).isEqualTo(mine);

        String other = api.signup();
        long theirs = api.createText(other, "es", "Adiós.", false);
        assertThat(save("{\"language\":\"es\",\"term\":\"adiós\",\"textId\":" + theirs + "}", 201).has("sourceText"))
                .isFalse();
    }
}
