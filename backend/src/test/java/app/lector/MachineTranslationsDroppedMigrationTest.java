package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

class MachineTranslationsDroppedMigrationTest {

    private static final String LAST_WITH_AMAZON_TRANSLATE = "26";

    private String db;
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        db = TestDatabases.newDatabase("machine-dropped");
        flyway(LAST_WITH_AMAZON_TRANSLATE).migrate();
        jdbc = new JdbcTemplate(TestDatabases.dataSource(db));
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(db)).target(target).load();
    }

    private void counter(String layer, long lookups, long tokensIn) {
        jdbc.update("""
                insert into lookup_counters (day, source_language, target_language, layer, lookups, translate_calls,
                    translate_characters, translate_failures, translate_capped, ai_calls, ai_tokens_in,
                    ai_tokens_out, ai_failures)
                values ('2026-10-20', 'FR', 'PL', ?, ?, 3, 40, 1, 0, 2, ?, 5, 1)""", layer, lookups, tokensIn);
    }

    private boolean tableExists(String table) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass(?) is not null", Boolean.class, table));
    }

    private List<String> columns(String table) {
        return jdbc.queryForList("select column_name from information_schema.columns where table_name = ?",
                String.class, table);
    }

    @Test
    void storedMachineTranslationsAndTheMonthlyUsageAreGone() {
        jdbc.update("insert into machine_translations (source_language, target_language, term, translation, "
                + "created_at) values ('FR', 'PL', 'banco', 'bank', now())");
        jdbc.update("insert into translation_usage (month, characters) values ('2026-10', 500)");
        flyway("latest").migrate();
        assertThat(tableExists("machine_translations")).isFalse();
        assertThat(tableExists("translation_usage")).isFalse();
    }

    @Test
    void machineLookupCountsAreDeletedAndEveryOtherKindIsKept() {
        counter("MACHINE_NEW", 4, 0);
        counter("MACHINE_STORED", 9, 0);
        for (String layer : List.of("AI_NEW", "AI_STORED", "COMMUNITY", "NONE")) {
            counter(layer, 7, 120);
        }
        flyway("latest").migrate();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select layer, lookups, ai_calls, ai_tokens_in, ai_tokens_out, ai_failures from lookup_counters "
                        + "order by layer");
        assertThat(rows).extracting(r -> r.get("layer")).containsExactly("AI_NEW", "AI_STORED", "COMMUNITY", "NONE");
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.get("lookups")).isEqualTo(7L);
            assertThat(r.get("ai_calls")).isEqualTo(2L);
            assertThat(r.get("ai_tokens_in")).isEqualTo(120L);
            assertThat(r.get("ai_tokens_out")).isEqualTo(5L);
            assertThat(r.get("ai_failures")).isEqualTo(1L);
        });
    }

    @Test
    void lookupCountsNoLongerHaveAmazonColumnsOrMachineKinds() {
        flyway("latest").migrate();
        assertThat(columns("lookup_counters")).doesNotContain("translate_calls", "translate_characters",
                "translate_failures", "translate_capped").contains("ai_calls", "lookups");
        assertThatThrownBy(() -> jdbc.update("""
                insert into lookup_counters (day, source_language, target_language, layer, lookups, ai_calls,
                    ai_tokens_in, ai_tokens_out, ai_failures)
                values ('2026-10-21', 'FR', 'PL', 'MACHINE_NEW', 1, 0, 0, 0, 0)"""))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void meaningsLearnersSavedToTheirOwnWordsAreKept() {
        long user = jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), 'Ana', 'ana@example.com', 'x', 'FREE', 'UTC') returning id""", Long.class);
        jdbc.update("""
                insert into vocabulary_entries (ease_factor, interval_days, lapses, repetitions, created_at,
                    updated_at, user_id, display_term, term, kind, language, status, meaning, meaning_language)
                values (2.5, 0, 0, 0, now(), now(), ?, 'banco', 'banco', 'WORD', 'FR', 'LEARNING', 'bank', 'PL')""",
                user);
        flyway("latest").migrate();
        assertThat(jdbc.queryForList("select meaning from vocabulary_entries where user_id = ?", String.class, user))
                .containsExactly("bank");
    }
}
