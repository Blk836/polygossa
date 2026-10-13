package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class PhraseSpacingApiTest {

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

    private void savePhrase(String term, String status) throws Exception {
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\",\"displayTerm\":\"" + term
                + "\",\"kind\":\"phrase\",\"status\":\"" + status + "\"}", 201);
    }

    private List<String> phrasesIn(String content) throws Exception {
        long id = api.createText(token, "fr", content, false);
        List<String> terms = new ArrayList<>();
        for (JsonNode p : api.get(token, "/api/texts/" + id, 200).get("phrases")) {
            terms.add(p.get("term").asString() + "=" + p.get("status").asString());
        }
        return terms;
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", " ", "\\n", "  ", " \\n "})
    void aPhraseIsFoundWhateverSpacingSeparatesItsWords(String gap) throws Exception {
        savePhrase("voix haute", "learning");
        assertThat(phrasesIn("Il lit à voix" + gap + "haute pour sa fille.")).containsExactly("voix haute=learning");
    }

    @Test
    void aPhraseIsFoundWhenTheTextHasACurlyApostrophe() throws Exception {
        savePhrase("l’eau froide", "learning");
        assertThat(phrasesIn("Il boit de l’eau froide.")).containsExactly("l'eau froide=learning");
    }

    @Test
    void aPhraseTheTextDoesNotContainStaysOut() throws Exception {
        savePhrase("voix basse", "learning");
        assertThat(phrasesIn("Il lit à voix haute.")).isEmpty();
    }

    @Test
    void wordsWithNoSeparatorDoNotMatchAPhrase() throws Exception {
        savePhrase("voix haute", "learning");
        assertThat(phrasesIn("Il lit voixhaute.")).isEmpty();
    }
}
