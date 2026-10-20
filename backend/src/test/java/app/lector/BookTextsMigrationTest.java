package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BookTextsMigrationTest {

    private static final String LAST_WITHOUT_BOOK_MARK = "19";

    private String db;
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        db = TestDatabases.newDatabase("booktexts");
        flyway(LAST_WITHOUT_BOOK_MARK).migrate();
        jdbc = new JdbcTemplate(TestDatabases.dataSource(db));
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(db)).target(target).load();
    }

    private long user(String email) {
        return jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), 'Ana', ?, 'x', 'FREE', 'UTC') returning id""", Long.class, email);
    }

    private long text(long owner, String title, boolean shared) {
        return jdbc.queryForObject("""
                insert into texts (is_public, unique_word_count, word_count, created_at, owner_id, language, title)
                values (?, 1, 1, now(), ?, 'ES', ?) returning id""", Long.class, shared, owner, title);
    }

    private long playlist(long owner, String description) {
        return jdbc.queryForObject("""
                insert into playlists (is_public, created_at, owner_id, updated_at, title, description, language)
                values (false, now(), ?, now(), 'Libro', ?, 'ES') returning id""", Long.class, owner, description);
    }

    private void add(long playlist, long text, int position) {
        jdbc.update("insert into playlist_items (position, playlist_id, text_id) values (?, ?, ?)", position, playlist, text);
    }

    private boolean column(long text, String name) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select " + name + " from texts where id = ?", Boolean.class, text));
    }

    @Test
    void chaptersOfAnImportedBookAreMarkedAndMadePrivate() {
        long ana = user("ana@example.com");
        long bob = user("bob@example.com");
        long book = playlist(ana, "Imported from viaje.epub");
        long kept = text(ana, "Capítulo 1", false);
        long shared = text(ana, "Capítulo 2", true);
        long sharedByOther = text(bob, "Algo de Bob", true);
        add(book, kept, 0);
        add(book, shared, 1);
        add(book, sharedByOther, 2);
        long ownList = playlist(ana, "Mis favoritos");
        long pasted = text(ana, "Pegado", true);
        add(ownList, pasted, 0);

        flyway("latest").migrate();

        assertThat(column(kept, "from_book")).isTrue();
        assertThat(column(shared, "from_book")).isTrue();
        assertThat(column(shared, "is_public")).isFalse();
        assertThat(column(sharedByOther, "from_book")).isFalse();
        assertThat(column(sharedByOther, "is_public")).isTrue();
        assertThat(column(pasted, "from_book")).isFalse();
        assertThat(column(pasted, "is_public")).isTrue();
    }
}
