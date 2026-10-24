package app.lector.vocabmap;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import java.sql.Timestamp;
import java.time.Instant;
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
class VocabMapApiTest {

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

    private JsonNode map(String language) throws Exception {
        return api.get(token, "/api/vocab-map?language=" + language, 200);
    }

    private void save(String term, String status) throws Exception {
        save(term, status, null);
    }

    private void save(String term, String status, String meaning) throws Exception {
        String extra = meaning == null ? "" : ",\"meaning\":\"" + meaning + "\"";
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\",\"status\":\"" + status
                + "\"" + extra + "}", 201);
    }

    private static JsonNode word(JsonNode map, String term) {
        for (JsonNode region : map.get("regions")) {
            for (JsonNode area : region.get("areas")) {
                for (JsonNode w : area.get("words")) {
                    if (w.get("term").asString().equals(term)) {
                        return w;
                    }
                }
            }
        }
        throw new AssertionError(term + " is not on the map");
    }

    private static JsonNode area(JsonNode map, String id) {
        for (JsonNode region : map.get("regions")) {
            for (JsonNode area : region.get("areas")) {
                if (area.get("id").asString().equals(id)) {
                    return area;
                }
            }
        }
        throw new AssertionError(id + " is not an area");
    }

    private static String status(JsonNode word) {
        JsonNode s = word.path("status");
        return s.isMissingNode() || s.isNull() ? null : s.asString();
    }

    @Test
    void frenchHasTheWholeBlueprintWithEveryWordNewAtFirst() throws Exception {
        JsonNode map = map("fr");
        assertThat(map.get("available").asBoolean()).isTrue();
        assertThat(map.get("regions")).hasSize(14);
        assertThat(map.get("bands")).extracting(JsonNode::asString).containsExactly("A1", "A2", "B1", "B2", "C1");
        assertThat(map.get("meaningLanguage").asString()).isEqualTo("en");
        assertThat(map.get("beyondCore").asInt()).isZero();
        JsonNode pomme = word(map, "pomme");
        assertThat(pomme.get("band").asString()).isEqualTo("A1");
        assertThat(pomme.get("meaning").asString()).isEqualTo("apple");
        assertThat(status(pomme)).isNull();
        assertThat(area(map, "fruit-veg").get("name").asString()).isEqualTo("Fruit & vegetables");
        int words = 0;
        for (JsonNode region : map.get("regions")) {
            for (JsonNode a : region.get("areas")) {
                words += a.get("words").size();
            }
        }
        assertThat(words).isBetween(6800, 9200);
    }

    @Test
    void aLanguageWithoutAListIsNotAvailableYet() throws Exception {
        JsonNode map = map("es");
        assertThat(map.get("available").asBoolean()).isFalse();
        assertThat(map.get("regions")).isEmpty();
        assertThat(map.get("bands")).isEmpty();
    }

    @Test
    void theLanguageIsRequired() throws Exception {
        api.get(token, "/api/vocab-map", 400);
    }

    @Test
    void signInIsRequired() throws Exception {
        api.get(null, "/api/vocab-map?language=fr", 401);
    }

    @Test
    void aWordCountsInWhateverFormIKnowIt() throws Exception {
        save("mangé", "known");
        assertThat(status(word(map("fr"), "manger"))).isEqualTo("known");
    }

    @Test
    void aKnownFormBeatsALearningOne() throws Exception {
        save("mange", "learning");
        save("mangé", "known");
        assertThat(status(word(map("fr"), "manger"))).isEqualTo("known");
    }

    @Test
    void learningAndIgnoredWordsKeepTheirStatus() throws Exception {
        save("poire", "learning");
        save("je", "ignored");
        JsonNode map = map("fr");
        assertThat(status(word(map, "poire"))).isEqualTo("learning");
        assertThat(status(word(map, "je"))).isEqualTo("ignored");
    }

    @Test
    void aLearningFormBeatsAnIgnoredOne() throws Exception {
        save("mange", "ignored");
        save("manges", "learning");
        assertThat(status(word(map("fr"), "manger"))).isEqualTo("learning");
    }

    @Test
    void theMeaningIsTheSenseOfTheAreaTheWordIsIn() throws Exception {
        JsonNode map = map("fr");
        assertThat(word(map, "glace").get("meaning").asString()).isEqualTo("ice cream");
        assertThat(word(map, "avocat").get("meaning").asString()).isEqualTo("avocado");
        assertThat(area(map, "meat-fish").get("words")).anySatisfy(w ->
                assertThat(w.get("term").asString()).isEqualTo("glace"));
    }

    @Test
    void myOwnSavedMeaningWins() throws Exception {
        save("pomme", "learning", "apple (fruit)");
        assertThat(word(map("fr"), "pomme").get("meaning").asString()).isEqualTo("apple (fruit)");
    }

    @Test
    void aNativeLanguageTheListDoesNotCoverGetsNoMeaning() throws Exception {
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"pl\"}", 200);
        JsonNode map = map("fr");
        assertThat(map.get("meaningLanguage").asString()).isEqualTo("pl");
        JsonNode meaning = word(map, "pomme").path("meaning");
        assertThat(meaning.isMissingNode() || meaning.isNull()).isTrue();
    }

    @Test
    void knownWordsOutsideTheListCountAsBeyondTheCore() throws Exception {
        save("zzyzx", "known");
        save("ordinateuresque", "known");
        save("quelquechosedenouveau", "learning");
        save("pomme", "known");
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"tout à fait\",\"kind\":\"phrase\","
                + "\"status\":\"known\"}", 201);
        assertThat(map("fr").get("beyondCore").asInt()).isEqualTo(2);
    }

    @Test
    void theReadingLevelComesWithTheMap() throws Exception {
        assertThat(map("fr").path("readingLevel").isNull() || map("fr").path("readingLevel").isMissingNode())
                .isTrue();
        long user = api.get(token, "/api/me", 200).get("id").asLong();
        insertKnown(user, 50);
        assertThat(map("fr").get("readingLevel").asString()).isEqualTo("A1");
    }

    @Test
    void otherLearnersWordsDontShow() throws Exception {
        String other = api.signup();
        api.post(other, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"pomme\",\"status\":\"known\"}", 201);
        assertThat(status(word(map("fr"), "pomme"))).isNull();
    }

    @Test
    void theMapAnswersQuicklyForALargeVocabulary() throws Exception {
        long user = api.get(token, "/api/me", 200).get("id").asLong();
        insertKnown(user, 30_000);
        map("fr");
        long quickest = Long.MAX_VALUE;
        for (int run = 0; run < 3; run++) {
            long start = System.nanoTime();
            JsonNode map = map("fr");
            quickest = Math.min(quickest, (System.nanoTime() - start) / 1_000_000);
            assertThat(map.get("beyondCore").asInt()).isEqualTo(30_000);
        }
        assertThat(quickest).isLessThan(1000);
    }

    private void insertKnown(long user, int count) {
        Timestamp now = Timestamp.from(Instant.now());
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            rows.add(new Object[] {user, "xq" + i, "xq" + i, now, now, now});
        }
        jdbc.batchUpdate("insert into vocabulary_entries (user_id, language, term, display_term, kind, status, "
                + "ease_factor, interval_days, lapses, repetitions, created_at, updated_at, known_at) "
                + "values (?, 'FR', ?, ?, 'WORD', 'KNOWN', 2.5, 0, 0, 0, ?, ?, ?)", rows);
    }
}
