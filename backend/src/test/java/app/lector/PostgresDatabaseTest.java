package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

@ApiTest
class PostgresDatabaseTest {

    @Autowired
    JdbcTemplate jdbc;

    @Value("${spring.datasource.url}")
    String url;

    @Test
    void runsOnPostgres17() {
        assertThat(jdbc.queryForObject("select version()", String.class)).startsWith("PostgreSQL 17");
    }

    @Test
    void usesItsOwnDatabaseNamedAfterTheSetup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).matches("api_\\d+");
    }

    @Test
    void neverConnectsToTheDevDatabase() {
        assertThat(url).startsWith("jdbc:postgresql://").doesNotContain(":5432/");
    }
}
