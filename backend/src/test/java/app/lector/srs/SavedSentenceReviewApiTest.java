package app.lector.srs;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class SavedSentenceReviewApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signupPro();
    }

    private long saveSentence(long text) throws Exception {
        return api.post(token, "/api/vocabulary", """
                {"language":"es","term":"El perro ladra mucho.","kind":"phrase",
                 "definition":"The dog barks a lot.","textId":%d}""".formatted(text), 201).get("id").asLong();
    }

    private JsonNode card(long id) throws Exception {
        JsonNode queue = api.get(token, "/api/review/queue?language=es&ahead=true", 200);
        return queue.valueStream().filter(c -> c.get("id").asLong() == id).findFirst().orElseThrow();
    }

    @Test
    void aSavedSentenceIsReviewedAsAPhraseShowingItsTranslationAndText() throws Exception {
        long text = api.createText(token, "es", "El perro ladra mucho.", false);
        long id = saveSentence(text);

        JsonNode card = card(id);

        assertThat(card.get("type").asString()).isEqualTo("word");
        assertThat(card.get("kind").asString()).isEqualTo("phrase");
        assertThat(card.get("front").asString()).isEqualTo("El perro ladra mucho.");
        assertThat(card.get("definition").asString()).isEqualTo("The dog barks a lot.");
        assertThat(card.get("sourceTextId").asLong()).isEqualTo(text);
    }

    @Test
    void aSingleWordCardSaysItIsAWord() throws Exception {
        long id = api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"perro\"}", 201).get("id").asLong();

        assertThat(card(id).get("kind").asString()).isEqualTo("word");
    }

    @Test
    void savingTheSameSentenceAgainKeepsOnePhrase() throws Exception {
        long text = api.createText(token, "es", "El perro ladra mucho.", false);

        assertThat(saveSentence(text)).isEqualTo(saveSentence(text));
        JsonNode phrases = api.get(token, "/api/vocabulary?language=es&kind=phrase&q=ladra", 200);
        assertThat(phrases.get("total").asLong()).isEqualTo(1);
    }

    @Test
    void theSeparateSentenceListIsGone() throws Exception {
        api.get(token, "/api/sentences", 404);
        assertThat(api.get(token, "/api/review/stats?language=es", 200).has("dueSentences")).isFalse();
    }
}
