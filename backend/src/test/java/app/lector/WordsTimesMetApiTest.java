package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class WordsTimesMetApiTest {

    private static final String MAISONS = "Maison neuve. La maison est belle. Une maison rouge. Le jardin et ta maison. "
            + "Ma maison est loin.";

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

    private void save(String term) throws Exception {
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\"}", 201);
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

    private JsonNode words(String query) throws Exception {
        return api.get(token, "/api/vocabulary?kind=word&" + query, 200).get("items");
    }

    private JsonNode entry(String term) throws Exception {
        for (JsonNode e : words("language=fr&size=200")) {
            if (e.get("term").asString().equals(term)) {
                return e;
            }
        }
        throw new AssertionError(term + " not listed");
    }

    private long met(String term) throws Exception {
        return entry(term).get("met").get("count").asLong();
    }

    private List<String> terms(JsonNode items) {
        List<String> out = new ArrayList<>();
        items.forEach(e -> out.add(e.get("term").asString()));
        return out;
    }

    @Test
    void onlyWhatIveReadCountsAndCapitalsCountTowardsTheSameWord() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        List<Integer> at = indexesOf(text, "maison");
        assertThat(at).hasSize(5);

        readTo(text, at.get(2) + 1);
        assertThat(met("maison")).isEqualTo(3);

        readTo(text, end(text));
        assertThat(met("maison")).isEqualTo(5);
    }

    @Test
    void openingATextWithoutMovingForwardCountsNothing() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, 0);
        assertThat(met("maison")).isZero();
        assertThat(entry("maison").get("met").get("share").asDouble()).isZero();
    }

    @Test
    void readingAgainCountsAgain() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));
        readTo(text, 0);
        readTo(text, end(text));
        assertThat(met("maison")).isEqualTo(10);
    }

    @Test
    void aWordNeverMetCountsZero() throws Exception {
        save("chat");
        assertThat(met("chat")).isZero();
    }

    @Test
    void theShareIsOutOfEverythingReadInThatLanguageOnly() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));
        long spanish = api.createText(token, "es", "uno dos tres cuatro cinco seis siete ocho nueve diez.", false);
        readTo(spanish, end(spanish));

        long words = 0;
        for (JsonNode t : api.get(token, "/api/texts/" + text, 200).get("tokens")) {
            words += t.path("word").asBoolean() ? 1 : 0;
        }
        assertThat(entry("maison").get("met").get("share").asDouble()).isCloseTo(5.0 / words, within(1e-9));

        JsonNode all = api.get(token, "/api/vocabulary?kind=word&size=200", 200).get("items");
        for (JsonNode e : all) {
            if (e.get("term").asString().equals("maison")) {
                assertThat(e.get("met").get("share").asDouble()).isCloseTo(5.0 / words, within(1e-9));
            }
        }
    }

    @Test
    void readingDoneBeforeCountingStartedIsCountedWhenWordsIsFirstOpened() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        List<Integer> at = indexesOf(text, "maison");
        readTo(text, at.get(1) + 1);
        long user = jdbc.queryForObject("select user_id from reading_progress where text_id = ?", Long.class, text);
        jdbc.update("delete from word_counts where user_id = ?", user);
        jdbc.update("delete from word_count_fills where user_id = ?", user);

        assertThat(met("maison")).isEqualTo(2);
        assertThat(met("maison")).isEqualTo(2);

        readTo(text, end(text));
        assertThat(met("maison")).isEqualTo(5);
    }

    @Test
    void readingBeforeWordsIsOpenedIsNotCountedTwice() throws Exception {
        save("maison");
        long text = api.createText(token, "fr", MAISONS, false);
        List<Integer> at = indexesOf(text, "maison");
        readTo(text, at.get(1) + 1);
        long user = jdbc.queryForObject("select user_id from reading_progress where text_id = ?", Long.class, text);
        jdbc.update("delete from word_counts where user_id = ?", user);
        jdbc.update("delete from word_count_fills where user_id = ?", user);

        readTo(text, end(text));
        assertThat(met("maison")).isEqualTo(5);
    }

    @Test
    void mostMetSortsByCountThenAlphabeticallyAndWorksWithFiltersAndPages() throws Exception {
        for (String term : new String[] {"chat", "maison", "est", "belle", "zèbre"}) {
            save(term);
        }
        api.patch(token, "/api/vocabulary/" + entry("zèbre").get("id").asLong(), "{\"status\":\"known\"}", 200);
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));

        assertThat(terms(words("language=fr&sort=met&size=200")))
                .containsExactly("maison", "est", "belle", "chat", "zèbre");
        assertThat(terms(words("language=fr&sort=met&status=learning&size=200")))
                .containsExactly("maison", "est", "belle", "chat");
        assertThat(terms(words("language=fr&sort=met&q=e&size=200"))).containsExactly("est", "belle", "zèbre");
        assertThat(terms(words("language=fr&sort=met&size=2&page=1"))).containsExactly("belle", "chat");
        assertThat(api.get(token, "/api/vocabulary?kind=word&language=fr&sort=met&size=2", 200).get("total").asLong())
                .isEqualTo(5);
    }

    @Test
    void phrasesHaveNoCount() throws Exception {
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"la maison\",\"kind\":\"phrase\"}", 201);
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));
        JsonNode phrases = api.get(token, "/api/vocabulary?kind=phrase&language=fr", 200).get("items");
        assertThat(phrases).hasSize(1);
        assertThat(phrases.get(0).has("met")).isFalse();
    }

    @Test
    void anUnknownSortFallsBackToMostRecent() throws Exception {
        save("chat");
        save("maison");
        api.patch(token, "/api/vocabulary/" + entry("chat").get("id").asLong(), "{\"note\":\"touched\"}", 200);
        assertThat(terms(words("language=fr&sort=nonsense"))).containsExactly("chat", "maison");
    }

    @Test
    void theCsvExportFollowsTheSortAndCapAndCarriesTimesMetAndShare() throws Exception {
        for (String term : new String[] {"chat", "maison", "est"}) {
            save(term);
        }
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));

        String[] lines = csv("?language=fr&status=learning&sort=met&limit=2").split("\r\n");
        assertThat(lines[0]).endsWith(",times_met,share");
        assertThat(lines).hasSize(3);
        assertThat(lines[1]).startsWith("maison,").contains(",5,");
        assertThat(lines[2]).startsWith("est,").contains(",2,");

        assertThat(csv("?language=fr&sort=met").split("\r\n")).hasSize(4);
    }

    @Test
    void theAnkiExportHoldsOnlyTheTopMostMetWords() throws Exception {
        for (String term : new String[] {"chat", "maison", "est", "belle"}) {
            save(term);
        }
        long text = api.createText(token, "fr", MAISONS, false);
        readTo(text, end(text));

        assertThat(ankiTerms("?language=fr&status=learning&sort=met&limit=2")).containsExactlyInAnyOrder("maison", "est");
        assertThat(ankiTerms("?language=fr&status=learning&sort=met")).hasSize(4);
    }

    private String csv(String query) throws Exception {
        byte[] body = mvc.perform(MockMvcRequestBuilders.get("/api/vocabulary/export.csv" + query)
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        return new String(body, StandardCharsets.UTF_8).replace("﻿", "");
    }

    private List<String> ankiTerms(String query) throws Exception {
        byte[] apkg = mvc.perform(MockMvcRequestBuilders.get("/api/vocabulary/export.apkg" + query)
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        Path db = Files.createTempFile("times-met", ".anki2");
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(apkg))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                if (e.getName().equals("collection.anki2")) {
                    Files.write(db, zip.readAllBytes());
                }
            }
        }
        List<String> out = new ArrayList<>();
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath());
             Statement st = conn.createStatement()) {
            ResultSet notes = st.executeQuery("SELECT sfld FROM notes");
            while (notes.next()) {
                out.add(notes.getString(1));
            }
        } finally {
            Files.deleteIfExists(db);
        }
        return out;
    }
}
