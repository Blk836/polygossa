package app.lector;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Points every app booted from the test classpath (backend tests, and the e2e backend, {@link E2eApplication}) at a
 * new, empty database in a PostgreSQL container that Testcontainers starts once per JVM and removes when it exits.
 * Never the dev database: whatever URL the app was configured with is overridden. The database is named after the
 * {@code test.database} property (a setup's name, e.g. "api") plus a boot counter, so an app Spring boots again
 * starts empty, as it did on H2's in-memory databases. A test that prepares a database first ({@link #newDatabase})
 * boots the app on it with {@code test.database.existing=<its name>}. Registered in META-INF/spring.factories.
 */
public class TestDatabases implements EnvironmentPostProcessor {

    private static final AtomicInteger BOOTS = new AtomicInteger();
    private static PostgreSQLContainer container;

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication application) {
        String existing = env.getProperty("test.database.existing");
        String name = existing != null ? existing : newDatabase(env.getProperty("test.database", "test"));
        PostgreSQLContainer pg = container();
        env.getPropertySources().addFirst(new MapPropertySource("testDatabase", Map.of(
                "spring.datasource.url", url(name),
                "spring.datasource.username", pg.getUsername(),
                "spring.datasource.password", pg.getPassword(),
                // A JVM caches many booted apps; idle connections for each would exhaust the server.
                "spring.datasource.hikari.minimum-idle", "1",
                "spring.docker.compose.enabled", "false")));
    }

    /** Creates a new, empty database named after {@code setup} plus a counter, and returns its name. */
    public static String newDatabase(String setup) {
        String name = setup.toLowerCase(Locale.ROOT).replaceAll("\\W", "_") + "_" + BOOTS.incrementAndGet();
        execute(container(), "create database " + name);
        return name;
    }

    public static String url(String database) {
        PostgreSQLContainer pg = container();
        return "jdbc:postgresql://%s:%d/%s".formatted(pg.getHost(), pg.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT),
                database);
    }

    public static Connection connect(String database) throws SQLException {
        PostgreSQLContainer pg = container();
        return DriverManager.getConnection(url(database), pg.getUsername(), pg.getPassword());
    }

    public static DataSource dataSource(String database) {
        PostgreSQLContainer pg = container();
        return new DriverManagerDataSource(url(database), pg.getUsername(), pg.getPassword());
    }

    /** Durability is switched off: the container is thrown away, and tests write a lot. */
    private static synchronized PostgreSQLContainer container() {
        if (container == null) {
            container = new PostgreSQLContainer("postgres:17")
                    .withTmpFs(Map.of("/var/lib/postgresql/data", "rw"))
                    .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off",
                            "-c", "full_page_writes=off", "-c", "max_connections=500");
            container.start();
        }
        return container;
    }

    private static void execute(PostgreSQLContainer pg, String sql) {
        try (Connection conn = DriverManager.getConnection(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
             Statement st = conn.createStatement()) {
            st.execute(sql);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not create test database: " + sql, e);
        }
    }
}
