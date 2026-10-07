package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * The backend the browser tests run against ({@link E2eApplication}, the "e2e" profile on the test classpath): its own
 * PostgreSQL container, otherwise configured like development rather than like the backend tests.
 */
@SpringBootTest(properties = "app.seed-samples=false")
@ActiveProfiles("e2e")
class E2eProfileTest {

    @Autowired
    Environment env;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void runsOnItsOwnTestcontainersDatabase() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).matches("e2e_\\d+");
        assertThat(env.getProperty("spring.datasource.url")).doesNotContain(":5432/");
    }

    @Test
    void undoesTheBackendTestsOwnSettings() {
        assertThat(env.getProperty("app.forum.admins")).isEqualTo("test@lector.local");
        assertThat(env.getProperty("app.recommend.feature-job")).isEqualTo("true");
        assertThat(env.getProperty("app.youtube.cache-ttl")).isEqualTo("10m");
    }

    @Test
    void neverStartsTheDevDatabase() {
        assertThat(env.getProperty("spring.docker.compose.enabled")).isEqualTo("false");
    }

    @Test
    void neverCallsOpenAi() {
        assertThat(env.getProperty("app.openai.api-key")).isEmpty();
    }
}
