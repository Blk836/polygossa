package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.EnumCheckMigration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * Regression: Hibernate writes a check constraint listing an enum's values when it creates a column, and ddl-auto
 * update never changes it. A database made before English existed refused English texts, so the startup that seeds the
 * English starter failed. At startup, constraints listing an older set of an enum's values get the current set.
 * Its own database: the test rewrites constraints.
 */
@SpringBootTest(properties = {
        "test.database=enumcheck",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class EnumCheckMigrationTest {

    static final String OLD = "('ES','FR','DE','IT','PT','JA','ZH','KO')";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EnumCheckMigration migration;

    private String definition(String constraint) {
        return jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conname = ?",
                String.class, constraint);
    }

    private void makeOld(String table, String column, String constraint) {
        jdbc.execute("alter table " + table + " drop constraint if exists " + constraint);
        jdbc.execute("alter table " + table + " add constraint " + constraint + " check (" + column + " in " + OLD + ")");
    }

    @Test
    void anOldLanguageListGetsEveryLanguageAndEnglishTextsCanBeSaved() throws Exception {
        makeOld("texts", "language", "texts_language_check");
        makeOld("users", "target_language", "users_target_language_check");
        String nativeBefore = definition("users_native_language_check");
        TestApi api = new TestApi(mvc, json);
        String me = api.signup();
        api.post(me, "/api/texts", "{\"title\":\"T\",\"language\":\"en\",\"content\":\"Hello.\",\"isPublic\":false}", 500);

        migration.run(null);

        assertThat(definition("texts_language_check")).contains("'EN'").contains("'KO'");
        assertThat(definition("users_target_language_check")).contains("'EN'");
        assertThat(definition("users_native_language_check")).isEqualTo(nativeBefore);
        api.createText(me, "en", "Hello there.", false);
        api.patch(me, "/api/me", "{\"targetLanguage\":\"en\"}", 200);

        String after = definition("texts_language_check");
        migration.run(null);
        assertThat(definition("texts_language_check")).isEqualTo(after);
    }
}
