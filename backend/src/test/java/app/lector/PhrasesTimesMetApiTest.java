package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class PhrasesTimesMetApiTest {

    private static final String TEXT = "Tout à  fait. Je suis tout à fait d'accord. Oui, tout à fait.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    TestApi api;
    String token;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
    }

    private long savePhrase(String term) throws Exception {
        return api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\",\"kind\":\"phrase\"}", 201)
                .get("id").asLong();
    }

    private List<Integer> indexesOf(long text, String normalized) throws Exception {
        List<Integer> out = new ArrayList<>();
        for (JsonNode t : api.get(token, "/api/texts/" + text, 200).get("tokens")) {
            if (t.path("word").asBoolean() && normalized.equals(t.path("normalized").asString())) {
                out.add(t.get("index").asInt());
            }
        }
        return out;
    }

    private int end(long text) throws Exception {
        return api.get(token, "/api/texts/" + text, 200).get("tokens").size() - 1;
    }

    private void readTo(long text, int position) throws Exception {
        api.post(token, "/api/texts/" + text + "/progress", "{\"position\":" + position + "}", 200);
    }

    private JsonNode phrases(String query) throws Exception {
        return api.get(token, "/api/vocabulary?kind=phrase&language=fr&size=200&" + query, 200).get("items");
    }

    private JsonNode met(String term) throws Exception {
        for (JsonNode e : phrases("")) {
            if (e.get("term").asString().equals(term)) {
                return e.get("met");
            }
        }
        throw new AssertionError(term + " not listed");
    }

    private List<String> terms(JsonNode items) {
        List<String> out = new ArrayList<>();
        items.forEach(e -> out.add(e.get("term").asString()));
        return out;
    }

    @Test
    void aPhraseCountsEachTimeIReadPastAllOfItIgnoringCapitalsAndSpacing() throws Exception {
        savePhrase("tout à fait");
        long text = api.createText(token, "fr", TEXT, false);
        List<Integer> fait = indexesOf(text, "fait");
        assertThat(fait).hasSize(3);

        readTo(text, fait.get(1) + 1);
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(2);

        readTo(text, end(text));
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(3);
        assertThat(met("tout à fait").has("share")).isFalse();
    }

    @Test
    void halfAPhraseDoesntCountUntilItsLastWordIsRead() throws Exception {
        savePhrase("tout à fait");
        long text = api.createText(token, "fr", TEXT, false);
        int firstFait = indexesOf(text, "fait").get(0);

        readTo(text, firstFait);
        assertThat(met("tout à fait").get("count").asLong()).isZero();

        readTo(text, firstFait + 1);
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(1);
    }

    @Test
    void aPhraseSavedLaterGetsCreditForWhatIdAlreadyRead() throws Exception {
        long text = api.createText(token, "fr", TEXT, false);
        readTo(text, end(text));
        savePhrase("tout à fait");
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(3);
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(3);
    }

    @Test
    void readingAgainCountsAgain() throws Exception {
        savePhrase("tout à fait");
        long text = api.createText(token, "fr", TEXT, false);
        readTo(text, end(text));
        readTo(text, 0);
        readTo(text, end(text));
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(6);
    }

    @Test
    void aPhraseNeverMetCountsZero() throws Exception {
        savePhrase("pas du tout");
        assertThat(met("pas du tout").get("count").asLong()).isZero();
    }

    @Test
    void mostMetSortsPhrasesByCountThenAlphabeticallyAcrossPages() throws Exception {
        savePhrase("pas du tout");
        savePhrase("je suis");
        savePhrase("tout à fait");
        savePhrase("au revoir");
        long text = api.createText(token, "fr", TEXT, false);
        readTo(text, end(text));

        assertThat(terms(phrases("sort=met"))).containsExactly("tout à fait", "je suis", "au revoir", "pas du tout");
        assertThat(terms(phrases("sort=met&q=tout"))).containsExactly("tout à fait", "pas du tout");
        assertThat(terms(api.get(token, "/api/vocabulary?kind=phrase&language=fr&sort=met&size=2&page=1", 200)
                .get("items"))).containsExactly("au revoir", "pas du tout");
    }

    @Test
    void deletingAPhraseRemovesItsCountAndReSavingFillsItAgainFromMyReading() throws Exception {
        long id = savePhrase("tout à fait");
        long text = api.createText(token, "fr", TEXT, false);
        readTo(text, end(text));
        readTo(text, 0);
        readTo(text, end(text));
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(6);

        api.delete(token, "/api/vocabulary/" + id, 204);
        assertThat(jdbc.queryForObject("select count(*) from phrase_counts where entry_id = ?", Long.class, id))
                .isZero();

        savePhrase("tout à fait");
        assertThat(met("tout à fait").get("count").asLong()).isEqualTo(3);
    }
}
