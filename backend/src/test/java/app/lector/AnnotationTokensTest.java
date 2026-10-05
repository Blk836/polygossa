package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.text.AnnotationBackfill;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Token;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Caption annotations ("[musique]") are not words, in new imports and, after the startup backfill, old ones. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:annotations;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class AnnotationTokensTest {

    private static final String CONTENT = "[musique] Bonjour à tous.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    @Autowired
    AnnotationBackfill backfill;

    TestApi api;
    String token;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
    }

    private JsonNode detail(long id) throws Exception {
        return api.get(token, "/api/texts/" + id, 200);
    }

    private static List<String> words(JsonNode detail) {
        return detail.get("tokens").valueStream().filter(t -> t.get("word").asBoolean()).map(t -> t.get("text").asString()).toList();
    }

    /** Stores the tokens and counts a text imported before annotations were recognised would have. */
    private void makeLegacy(long id) {
        Text text = texts.findById(id).orElseThrow();
        List<Token> legacy = List.of(
                new Token(0, "[", false, null, null, null, 0),
                new Token(1, "musique", true, "musique", null, null, 0),
                new Token(2, "] ", false, null, null, null, 0),
                new Token(3, "Bonjour", true, "bonjour", null, null, 0),
                new Token(4, " ", false, null, null, null, 0),
                new Token(5, "à", true, "à", null, null, 0),
                new Token(6, " ", false, null, null, null, 0),
                new Token(7, "tous", true, "tous", null, null, 0),
                new Token(8, ".", false, null, null, null, 0));
        text.setTokensJson(json.writeValueAsString(legacy));
        text.setWordCount(4);
        text.setUniqueWordCount(4);
        text.setCefrLevel("C2");
        texts.save(text);
    }

    @Test
    void newImportsLeaveAnnotationsOutOfTheWordsAndCounts() throws Exception {
        JsonNode d = detail(api.createText(token, "fr", CONTENT, false));
        assertThat(words(d)).containsExactly("Bonjour", "à", "tous");
        assertThat(d.get("tokens").get(1).get("text").asString()).isEqualTo("musique");
        assertThat(d.get("text").get("wordCount").asInt()).isEqualTo(3);
        assertThat(d.get("text").get("uniqueWordCount").asInt()).isEqualTo(3);
    }

    @Test
    void theBackfillFixesTextsImportedBefore() throws Exception {
        long id = api.createText(token, "fr", CONTENT, false);
        String level = detail(id).get("text").get("cefrLevel").asString();
        makeLegacy(id);
        assertThat(words(detail(id))).contains("musique");

        backfill.run(null);

        JsonNode d = detail(id);
        assertThat(words(d)).containsExactly("Bonjour", "à", "tous");
        assertThat(d.get("tokens").size()).isEqualTo(9); // same tokens, so audio/video timings still line up
        assertThat(d.get("text").get("wordCount").asInt()).isEqualTo(3);
        assertThat(d.get("text").get("uniqueWordCount").asInt()).isEqualTo(3);
        assertThat(level).isNotEqualTo("C2");
        assertThat(d.get("text").get("cefrLevel").asString()).isEqualTo(level);
    }

    @Test
    void afterTheBackfillTurningThePageDoesNotMarkTheAnnotationKnown() throws Exception {
        long id = api.createText(token, "fr", CONTENT, false);
        makeLegacy(id);
        backfill.run(null);
        JsonNode r = api.post(token, "/api/texts/" + id + "/mark-known", "{\"fromToken\":0,\"toToken\":8}", 200);
        assertThat(r.get("markedKnown").asInt()).isEqualTo(3);
        JsonNode known = api.get(token, "/api/vocabulary?language=fr&sort=alpha&status=known", 200).get("items");
        assertThat(known).extracting(n -> n.get("term").asString()).containsExactlyInAnyOrder("à", "bonjour", "tous");
    }

    @Test
    void theBackfillLeavesTextsWithoutAnnotationsAlone() throws Exception {
        long id = api.createText(token, "fr", "Bonjour à tous.", false);
        Text before = texts.findById(id).orElseThrow();
        before.setWordCount(99); // a stale count proves the text was not rewritten
        texts.save(before);

        backfill.run(null);

        assertThat(texts.findById(id).orElseThrow().getWordCount()).isEqualTo(99);
    }
}
