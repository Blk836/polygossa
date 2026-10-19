package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BaseWordsMigrationTest {

    private static final String LAST_WITHOUT_BASE_WORDS = "18";

    private String db;
    private JdbcTemplate jdbc;
    private long user;
    private int lookups;

    @BeforeEach
    void setUp() {
        db = TestDatabases.newDatabase("basewords");
        flyway(LAST_WITHOUT_BASE_WORDS).migrate();
        jdbc = new JdbcTemplate(TestDatabases.dataSource(db));
        user = jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), 'Ana', 'ana@example.com', 'x', 'FREE', 'UTC') returning id""", Long.class);
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(db)).target(target).load();
    }

    private void word(String language, String term, String kind) {
        jdbc.update("""
                insert into vocabulary_entries (ease_factor, interval_days, lapses, repetitions, created_at,
                    updated_at, user_id, display_term, term, kind, language, status)
                values (2.5, 0, 0, 0, now(), now(), ?, ?, ?, ?, ?, 'KNOWN')""", user, term, term, kind, language);
    }

    private void lookup(String language, String term, String partOfSpeech, String lemma) {
        lookups++;
        jdbc.update("""
                insert into sentence_meanings (source_language, target_language, term, context_hash, meaning,
                    created_at, part_of_speech, lemma)
                values (?, 'EN', ?, ?, 'm', now(), ?, ?)""", language, term, "h" + lookups, partOfSpeech, lemma);
    }

    private String lemmaOf(String language, String term) {
        return jdbc.queryForObject("select lemma from vocabulary_entries where language = ? and term = ?",
                String.class, language, term);
    }

    @Test
    void aSavedWordGetsTheBaseWordAnEarlierLookupGave() {
        word("FR", "allons", "WORD");
        lookup("FR", "allons", "verb", "aller");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "allons")).isEqualTo("aller");
    }

    @Test
    void aLookupWithAWordTypeAndNoBaseWordMakesTheWordItsOwnBaseWord() {
        word("FR", "aller", "WORD");
        lookup("FR", "aller", "verb", null);

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "aller")).isEqualTo("aller");
    }

    @Test
    void aLookupWithNoWordTypeGivesNoBaseWord() {
        word("FR", "sifflotons", "WORD");
        lookup("FR", "sifflotons", null, null);

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "sifflotons")).isNull();
    }

    @Test
    void theMostFrequentBaseWordWins() {
        word("FR", "suis", "WORD");
        lookup("FR", "suis", "verb", "suivre");
        lookup("FR", "suis", "verb", "être");
        lookup("FR", "suis", "verb", "être");
        lookup("FR", "suis", "verb", "Être");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "suis")).isEqualTo("être");
    }

    @Test
    void aTieGoesToTheFirstInCharacterOrder() {
        word("FR", "suis", "WORD");
        lookup("FR", "suis", "verb", "être");
        lookup("FR", "suis", "verb", "suivre");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "suis")).isEqualTo("suivre");
    }

    @Test
    void theBaseWordIsStoredInTheSameFormAsTerms() {
        word("FR", "belles", "WORD");
        lookup("FR", "belles", "adjective", "  Beau ");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "belles")).isEqualTo("beau");
    }

    @Test
    void lookupsInAnotherLanguageAreNotUsed() {
        word("FR", "fue", "WORD");
        lookup("ES", "fue", "verb", "ir");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "fue")).isNull();
    }

    @Test
    void phrasesGetNoBaseWord() {
        word("FR", "tout à fait", "PHRASE");
        lookup("FR", "tout à fait", "phrase", "tout");

        flyway("latest").migrate();

        assertThat(lemmaOf("FR", "tout à fait")).isNull();
    }
}
