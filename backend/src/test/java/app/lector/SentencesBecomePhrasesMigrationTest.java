package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SentencesBecomePhrasesMigrationTest {

    private static final String LAST_WITH_SENTENCE_CARDS = "12";

    private String db;
    private JdbcTemplate jdbc;
    private long user;
    private long text;

    @BeforeEach
    void setUp() {
        db = TestDatabases.newDatabase("sentences");
        flyway(LAST_WITH_SENTENCE_CARDS).migrate();
        jdbc = new JdbcTemplate(TestDatabases.dataSource(db));
        user = jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), 'Ana', 'ana@example.com', 'x', 'FREE', 'UTC') returning id""", Long.class);
        text = jdbc.queryForObject("""
                insert into texts (is_public, unique_word_count, word_count, created_at, owner_id, language, title)
                values (false, 3, 3, now(), ?, 'ES', 'El perro') returning id""", Long.class, user);
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(db)).target(target).load();
    }

    private void sentence(String sentence, String translation, String notes, Long sourceText, String createdAt) {
        jdbc.update("""
                insert into sentence_cards (ease_factor, interval_days, lapses, repetitions, created_at, due_at,
                    last_reviewed_at, source_text_id, user_id, language, notes, sentence, translation)
                values (2.4, 6, 1, 3, ?::timestamptz, '2026-11-01T09:00:00Z', '2026-10-26T09:00:00Z', ?, ?, 'ES', ?, ?, ?)""",
                createdAt, sourceText, user, notes, sentence, translation);
    }

    private void word(String term, String definition) {
        jdbc.update("""
                insert into vocabulary_entries (ease_factor, interval_days, lapses, repetitions, created_at,
                    updated_at, user_id, display_term, term, definition, kind, language, status)
                values (2.5, 0, 0, 0, now(), now(), ?, ?, ?, ?, 'PHRASE', 'ES', 'KNOWN')""",
                user, term, term, definition);
    }

    private List<Map<String, Object>> entries() {
        return jdbc.queryForList("""
                select term, display_term, kind, status, definition, note, source_text_id, ease_factor, interval_days,
                    lapses, repetitions, due_at::text as due, last_reviewed_at::text as reviewed,
                    created_at::text as created, meaning
                from vocabulary_entries where user_id = ? order by term""", user);
    }

    @Test
    void aSavedSentenceBecomesAPhraseKeepingItsTranslationNotesTextAndSchedule() {
        sentence("  El perro’s ladra mucho.  ", "The dog barks a lot.", "remember ladrar", text, "2026-10-01T08:00:00Z");

        flyway("latest").migrate();

        assertThat(entries()).singleElement().satisfies(e -> {
            assertThat(e.get("term")).isEqualTo("el perro's ladra mucho.");
            assertThat(e.get("display_term")).isEqualTo("El perro’s ladra mucho.");
            assertThat(e.get("kind")).isEqualTo("PHRASE");
            assertThat(e.get("status")).isEqualTo("LEARNING");
            assertThat(e.get("definition")).isEqualTo("The dog barks a lot.");
            assertThat(e.get("meaning")).isNull();
            assertThat(e.get("note")).isEqualTo("remember ladrar");
            assertThat(((Number) e.get("source_text_id")).longValue()).isEqualTo(text);
            assertThat(e.get("ease_factor")).isEqualTo(2.4);
            assertThat(e.get("interval_days")).isEqualTo(6.0);
            assertThat(e.get("lapses")).isEqualTo(1);
            assertThat(e.get("repetitions")).isEqualTo(3);
            assertThat((String) e.get("due")).startsWith("2026-11-01 09:00:00");
            assertThat((String) e.get("reviewed")).startsWith("2026-10-26 09:00:00");
            assertThat((String) e.get("created")).startsWith("2026-10-01 08:00:00");
        });
    }

    @Test
    void theSentenceCardsTableIsGoneSoNoSentenceIsReviewedTwice() {
        sentence("El perro ladra.", null, null, null, "2026-10-01T08:00:00Z");

        flyway("latest").migrate();

        assertThat(jdbc.queryForObject("select to_regclass('sentence_cards') is null", Boolean.class)).isTrue();
        assertThat(entries()).hasSize(1);
    }

    @Test
    void theSameSentenceSavedTwiceBecomesOnePhraseFromTheFirstSave() {
        sentence("El perro ladra.", "first", null, null, "2026-10-01T08:00:00Z");
        sentence("el perro ladra.", "second", null, null, "2026-10-02T08:00:00Z");

        flyway("latest").migrate();

        assertThat(entries()).singleElement()
                .satisfies(e -> assertThat(e.get("definition")).isEqualTo("first"));
    }

    @Test
    void aSentenceAlreadySavedAsAPhraseIsNotDuplicatedAndOnlyFillsAMissingDefinition() {
        word("el perro ladra.", null);
        word("hola amigo.", "hello friend");
        sentence("El perro ladra.", "The dog barks.", null, null, "2026-10-01T08:00:00Z");
        sentence("Hola amigo.", "Hi pal.", null, null, "2026-10-01T08:00:00Z");

        flyway("latest").migrate();

        assertThat(entries()).extracting(e -> e.get("term") + " " + e.get("status") + " " + e.get("definition"))
                .containsExactly("el perro ladra. KNOWN The dog barks.", "hola amigo. KNOWN hello friend");
    }

    @Test
    void aSentenceLongerThanAPhraseCanHoldIsCutToFit() {
        sentence("A".repeat(600), null, null, null, "2026-10-01T08:00:00Z");

        flyway("latest").migrate();

        assertThat(entries()).singleElement().satisfies(e -> {
            assertThat((String) e.get("term")).isEqualTo("a".repeat(500));
            assertThat((String) e.get("display_term")).isEqualTo("A".repeat(500));
        });
    }

    @Test
    void anotherUsersPhraseDoesNotStopTheSentenceMoving() {
        long other = jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), 'Bo', 'bo@example.com', 'x', 'FREE', 'UTC') returning id""", Long.class);
        jdbc.update("""
                insert into vocabulary_entries (ease_factor, interval_days, lapses, repetitions, created_at,
                    updated_at, user_id, display_term, term, kind, language, status)
                values (2.5, 0, 0, 0, now(), now(), ?, 'x', 'el perro ladra.', 'PHRASE', 'ES', 'LEARNING')""", other);
        sentence("El perro ladra.", "The dog barks.", null, null, "2026-10-01T08:00:00Z");

        flyway("latest").migrate();

        assertThat(entries()).singleElement()
                .satisfies(e -> assertThat(e.get("definition")).isEqualTo("The dog barks."));
    }
}
