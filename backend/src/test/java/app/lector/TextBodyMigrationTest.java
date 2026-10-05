package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.text.TextBodyMigration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: a database from before text bodies were split off (content, tokens, timings and cues stored on the texts
 * row) is moved over at startup, and every text reads as before.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bodymigration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class TextBodyMigrationTest {

    private static final List<String> OLD_COLUMNS = List.of("content", "tokens_json", "timings_json", "cues_json");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TextBodyMigration migration;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
    }

    private List<String> textColumns() {
        return jdbc.queryForList("select lower(column_name) from information_schema.columns where lower(table_name) = 'texts'",
                String.class);
    }

    /** Puts the old columns back and copies a current text into a row laid out the old way (no body, no words). */
    private long legacyCopyOf(long id) {
        for (String column : OLD_COLUMNS) {
            jdbc.execute("alter table texts add column " + column + " text");
        }
        jdbc.update("""
                insert into texts (owner_id, title, language, content, tokens_json, timings_json, cues_json, is_public,
                                   word_count, unique_word_count, created_at)
                select t.owner_id, 'Legacy', t.language, b.content, b.tokens_json, '[]', '[{"startMs":0}]', t.is_public,
                       t.word_count, t.unique_word_count, t.created_at
                from texts t join text_bodies b on b.id = t.body_id where t.id = ?""", id);
        return jdbc.queryForObject("select max(id) from texts", Long.class);
    }

    @Test
    void movesOldRowsIntoBodiesAndDropsTheOldColumns() throws Exception {
        long current = api.createText(me, "fr", "Bonjour à tous. Le chat dort.", false);
        long legacy = legacyCopyOf(current);

        migration.run(null);

        assertThat(textColumns()).doesNotContainAnyElementsOf(OLD_COLUMNS);
        JsonNode before = api.get(me, "/api/texts/" + current, 200);
        JsonNode after = api.get(me, "/api/texts/" + legacy, 200);
        assertThat(after.get("tokens")).isEqualTo(before.get("tokens"));
        assertThat(jdbc.queryForObject("select b.cues_json from texts t join text_bodies b on b.id = t.body_id where t.id = ?",
                String.class, legacy)).isEqualTo("[{\"startMs\":0}]");
    }

    @Test
    void givesOldRowsTheirDistinctWordsSoCardsCountThem() throws Exception {
        long legacy = legacyCopyOf(api.createText(me, "fr", "Le chat. Le chien.", false));

        migration.run(null);

        assertThat(jdbc.queryForObject("select words_json from texts where id = ?", String.class, legacy))
                .isEqualTo("[\"le\",\"chat\",\"chien\"]");
        JsonNode card = api.get(me, "/api/texts?language=fr", 200).valueStream()
                .filter(c -> c.get("id").asLong() == legacy).findFirst().orElseThrow();
        assertThat(card.get("stats").get("uniqueWords").asInt()).isEqualTo(3);
    }

    @Test
    void runningAgainChangesNothing() throws Exception {
        long id = api.createText(me, "fr", "Le chat dort.", false);
        String words = jdbc.queryForObject("select words_json from texts where id = ?", String.class, id);

        migration.run(null);
        migration.run(null);

        assertThat(textColumns()).doesNotContainAnyElementsOf(OLD_COLUMNS);
        assertThat(jdbc.queryForObject("select words_json from texts where id = ?", String.class, id)).isEqualTo(words);
        assertThat(api.get(me, "/api/texts/" + id, 200).get("tokens").size()).isGreaterThan(3);
    }
}
