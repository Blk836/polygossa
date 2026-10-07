package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

/** Each app booted in a test gets an empty database of its own, as H2's in-memory databases did. */
class TestDatabasesTest {

    private final TestDatabases databases = new TestDatabases();

    private StandardEnvironment boot(Map<String, Object> properties) {
        StandardEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(new MapPropertySource("test", properties));
        databases.postProcessEnvironment(env, new SpringApplication());
        return env;
    }

    private Connection connect(StandardEnvironment env) throws SQLException {
        return DriverManager.getConnection(env.getProperty("spring.datasource.url"),
                env.getProperty("spring.datasource.username"), env.getProperty("spring.datasource.password"));
    }

    private static String query(Connection conn, String sql) throws SQLException {
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
        }
    }

    @Test
    void namesTheDatabaseAfterTheSetupAndCountsBoots() throws SQLException {
        StandardEnvironment env = boot(Map.of("test.database", "Some-Setup"));
        try (Connection conn = connect(env)) {
            assertThat(query(conn, "select current_database()")).matches("some_setup_\\d+");
        }
    }

    @Test
    void anAppWithoutANameStillGetsATestDatabase() throws SQLException {
        try (Connection conn = connect(boot(Map.of()))) {
            assertThat(query(conn, "select current_database()")).matches("test_\\d+");
        }
    }

    @Test
    void bootingTheSameSetupAgainStartsOnAnEmptyDatabase() throws SQLException {
        StandardEnvironment first = boot(Map.of("test.database", "again"));
        try (Connection conn = connect(first); Statement st = conn.createStatement()) {
            st.execute("create table leftover (id int)");
        }
        StandardEnvironment second = boot(Map.of("test.database", "again"));
        assertThat(second.getProperty("spring.datasource.url")).isNotEqualTo(first.getProperty("spring.datasource.url"));
        try (Connection conn = connect(second)) {
            assertThat(query(conn, "select count(*) from information_schema.tables where table_name = 'leftover'"))
                    .isEqualTo("0");
        }
    }

    @Test
    void overridesAnyConfiguredDatabase() {
        StandardEnvironment env = boot(Map.of("spring.datasource.url", "jdbc:postgresql://localhost:5432/lector",
                "spring.datasource.username", "lector"));
        assertThat(env.getProperty("spring.datasource.url")).doesNotContain(":5432/");
        assertThat(env.getProperty("spring.datasource.username")).isNotEqualTo("lector");
    }

    @Test
    void neverStartsDockerComposeForTheDevDatabase() {
        assertThat(boot(Map.of()).getProperty("spring.docker.compose.enabled")).isEqualTo("false");
    }
}
