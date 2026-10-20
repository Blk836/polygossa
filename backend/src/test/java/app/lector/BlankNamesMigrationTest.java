package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BlankNamesMigrationTest {

    private static final String LAST_WITH_BLANK_NAMES = "20";

    private String db;
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        db = TestDatabases.newDatabase("blanknames");
        flyway(LAST_WITH_BLANK_NAMES).migrate();
        jdbc = new JdbcTemplate(TestDatabases.dataSource(db));
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(db)).target(target).load();
    }

    private long user(String email, String name) {
        return jdbc.queryForObject("""
                insert into users (daily_review_goal, created_at, display_name, email, password_hash, tier, timezone)
                values (20, now(), ?, ?, 'x', 'FREE', 'UTC') returning id""", Long.class, name, email);
    }

    private String nameOf(long id) {
        return jdbc.queryForObject("select display_name from users where id = ?", String.class, id);
    }

    @Test
    void anEmptyNameBecomesTheEmailsNameAndOthersAreKept() {
        long empty = user("lucia.r@example.com", "");
        long spaces = user("tom@example.com", "   ");
        long named = user("ana@example.com", "Ana");

        flyway("latest").migrate();

        assertThat(nameOf(empty)).isEqualTo("lucia.r");
        assertThat(nameOf(spaces)).isEqualTo("tom");
        assertThat(nameOf(named)).isEqualTo("Ana");
    }
}
