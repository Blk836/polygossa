package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** POST /api/texts/{id}/mark-known: the reader's "turning the page marks its new words known". */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:markpage;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class MarkPageKnownTest {

    // Tokens: El(0) ' '(1) gato(2) ' '(3) come(4) '. '(5) La(6) ' '(7) casa(8) ' '(9) come(10) '.'(11)
    private static final String CONTENT = "El gato come. La casa come.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String token;
    long text;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
        text = api.createText(token, "es", CONTENT, false);
    }

    private JsonNode markKnown(String range, int status) throws Exception {
        return api.post(token, "/api/texts/" + text + "/mark-known", range, status);
    }

    private JsonNode vocabulary(String status) throws Exception {
        return api.get(token, "/api/vocabulary?language=es&sort=alpha&status=" + status, 200).get("items");
    }

    @Test
    void marksOnlyTheUnseenWordsInTheRangeKnown() throws Exception {
        JsonNode r = markKnown("{\"fromToken\":0,\"toToken\":5}", 200);
        assertThat(r.get("markedKnown").asInt()).isEqualTo(3);
        assertThat(vocabulary("known")).extracting(n -> n.get("term").asString()).containsExactly("come", "el", "gato");
    }

    @Test
    void includesBothEndsOfTheRange() throws Exception {
        assertThat(markKnown("{\"fromToken\":2,\"toToken\":2}", 200).get("markedKnown").asInt()).isEqualTo(1);
        assertThat(vocabulary("known")).extracting(n -> n.get("term").asString()).containsExactly("gato");
        assertThat(markKnown("{\"fromToken\":8,\"toToken\":11}", 200).get("markedKnown").asInt()).isEqualTo(2);
    }

    @Test
    void leavesWordsThatAlreadyHaveAStatusAlone() throws Exception {
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"el\",\"status\":\"ignored\"}", 201);
        assertThat(markKnown("{\"fromToken\":0,\"toToken\":5}", 200).get("markedKnown").asInt()).isEqualTo(1);
        assertThat(vocabulary("learning")).extracting(n -> n.get("term").asString()).containsExactly("gato");
        assertThat(vocabulary("ignored")).extracting(n -> n.get("term").asString()).containsExactly("el");
        assertThat(vocabulary("known")).extracting(n -> n.get("term").asString()).containsExactly("come");
    }

    @Test
    void recordsTheTextAsTheSource() throws Exception {
        markKnown("{\"fromToken\":0,\"toToken\":1}", 200);
        assertThat(vocabulary("known").get(0).get("sourceText").get("id").asLong()).isEqualTo(text);
    }

    @Test
    void isIdempotent() throws Exception {
        markKnown("{\"fromToken\":0,\"toToken\":11}", 200);
        assertThat(markKnown("{\"fromToken\":0,\"toToken\":11}", 200).get("markedKnown").asInt()).isZero();
    }

    @Test
    void aRangePastTheEndIsCutToTheText() throws Exception {
        assertThat(markKnown("{\"fromToken\":6,\"toToken\":999}", 200).get("markedKnown").asInt()).isEqualTo(3);
    }

    @Test
    void rejectsAnInvalidRange() throws Exception {
        assertThat(markKnown("{\"fromToken\":5,\"toToken\":2}", 400).get("code").asString()).isEqualTo("bad_request");
        markKnown("{\"fromToken\":-1,\"toToken\":2}", 400);
        markKnown("{\"toToken\":2}", 400);
        assertThat(vocabulary("known")).isEmpty();
    }

    @Test
    void returnsNotFoundForATextTheUserCannotRead() throws Exception {
        String other = api.signup();
        long theirs = api.createText(other, "es", "Adiós amigo.", false);
        api.post(token, "/api/texts/" + theirs + "/mark-known", "{\"fromToken\":0,\"toToken\":3}", 404);
    }
}
