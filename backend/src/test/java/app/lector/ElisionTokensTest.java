package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.progress.ReadingProgressRepository;
import app.lector.text.AudioAligner.WordTiming;
import app.lector.text.ElisionBackfill;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class ElisionTokensTest {

    private static final String CONTENT = "C'est l'homme qu'il aime.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    @Autowired
    ReadingProgressRepository progress;

    @Autowired
    ElisionBackfill backfill;

    @Autowired
    TransactionTemplate tx;

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

    private void makeLegacy(long id) {
        String[] parts = {"C'", "est", " ", "l'", "homme", " ", "qu'", "il", " ", "aime", "."};
        List<Token> legacy = new ArrayList<>();
        List<WordTiming> timings = new ArrayList<>();
        for (String part : parts) {
            boolean word = Character.isLetter(part.charAt(0));
            int i = legacy.size();
            legacy.add(new Token(i, part, word, word ? part.toLowerCase() : null, null, null, 0));
            if (word) {
                timings.add(new WordTiming(i, i * 100L, i * 100L + 100));
            }
        }
        tx.executeWithoutResult(status -> {
            Text text = texts.findById(id).orElseThrow();
            text.setTokensJson(json.writeValueAsString(legacy));
            text.setTimingsJson(json.writeValueAsString(timings));
            text.setWordCount(7);
            text.setUniqueWordCount(7);
            text.setCefrLevel("C2");
            texts.save(text);
        });
    }

    private List<WordTiming> timings(long id) {
        return tx.execute(status -> json.readValue(texts.findById(id).orElseThrow().getTimingsJson(),
                new TypeReference<List<WordTiming>>() {}));
    }

    private int position(long id) {
        return tx.execute(status -> progress.findForText(id).getFirst().getPosition());
    }

    @Test
    void newImportsKeepElisionsInOneWord() throws Exception {
        JsonNode d = detail(api.createText(token, "fr", CONTENT, false));
        assertThat(words(d)).containsExactly("C'est", "l'homme", "qu'il", "aime");
        assertThat(d.get("text").get("wordCount").asInt()).isEqualTo(4);
    }

    @Test
    void theBackfillJoinsElisionsInTextsImportedBefore() throws Exception {
        long id = api.createText(token, "fr", CONTENT, false);
        String level = detail(id).get("text").get("cefrLevel").asString();
        makeLegacy(id);
        api.post(token, "/api/texts/" + id + "/progress", "{\"position\":9}", 200);
        assertThat(words(detail(id))).contains("C'", "est");

        backfill.run(null);

        JsonNode d = detail(id);
        assertThat(words(d)).containsExactly("C'est", "l'homme", "qu'il", "aime");
        assertThat(d.get("tokens").get(6).get("text").asString()).isEqualTo("aime");
        assertThat(d.get("text").get("wordCount").asInt()).isEqualTo(4);
        assertThat(d.get("text").get("uniqueWordCount").asInt()).isEqualTo(4);
        assertThat(d.get("text").get("cefrLevel").asString()).isEqualTo(level);
        assertThat(timings(id)).containsExactly(new WordTiming(0, 0, 200), new WordTiming(2, 300, 500),
                new WordTiming(4, 600, 800), new WordTiming(6, 900, 1000));
        assertThat(position(id)).isEqualTo(6);
    }

    @Test
    void theBackfillFixesEachTextOnItsOwn() throws Exception {
        long broken = api.createText(token, "fr", CONTENT, false);
        long fine = api.createText(token, "fr", CONTENT, false);
        makeLegacy(fine);
        tx.executeWithoutResult(status -> {
            Text text = texts.findById(broken).orElseThrow();
            text.setTokensJson("[{\"index\":0,\"text\":\"l'\",\"word\":true,\"normalized\":\"l'\",\"sentence\":0},");
            texts.save(text);
        });
        try {
            backfill.run(null);

            assertThat(words(detail(fine))).containsExactly("C'est", "l'homme", "qu'il", "aime");
        } finally {
            api.delete(token, "/api/texts/" + broken, 204);
        }
    }

    @Test
    void theBackfillLeavesTextsThatAreAlreadyRightAlone() throws Exception {
        long id = api.createText(token, "fr", CONTENT, false);
        tx.executeWithoutResult(status -> {
            Text before = texts.findById(id).orElseThrow();
            before.setWordCount(99);
            texts.save(before);
        });

        backfill.run(null);

        assertThat(texts.findById(id).orElseThrow().getWordCount()).isEqualTo(99);
    }
}
