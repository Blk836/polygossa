package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Feature: versioned schema changes with Flyway (docs/acceptance/flyway.feature). Each test prepares a database in a
 * given state, then boots the whole app on it, as a deploy would. Extra migrations (V2, V3) live in a temporary folder
 * added to the app's migration locations.
 */
class SchemaMigrationTest {

    @TempDir
    Path extra;

    /** Boots the app on {@code database}; properties are passed as command-line arguments, so they win over YAML. */
    private static ConfigurableApplicationContext boot(String database, String... properties) {
        List<String> args = new ArrayList<>(List.of("--test.database.existing=" + database, "--server.port=0",
                "--app.seed-samples=false", "--app.storage.dir=build/test-uploads"));
        Arrays.stream(properties).map(p -> "--" + p).forEach(args::add);
        return new SpringApplicationBuilder(LectorApplication.class).run(args.toArray(String[]::new));
    }

    private String withExtra() {
        return "spring.flyway.locations=classpath:db/migration,filesystem:" + extra.toAbsolutePath();
    }

    private Flyway flyway(String database, String target) {
        return Flyway.configure().dataSource(TestDatabases.dataSource(database))
                .locations("classpath:db/migration", "filesystem:" + extra.toAbsolutePath()).target(target).load();
    }

    private void migration(String file, String sql) throws IOException {
        Files.writeString(extra.resolve(file), sql);
    }

    private static JdbcTemplate jdbc(String database) {
        return new JdbcTemplate(TestDatabases.dataSource(database));
    }

    /** The history Flyway keeps: version and type (SQL, BASELINE) of each successful step, in order. */
    private static List<String> history(String database) {
        return jdbc(database).queryForList("""
                select version || ' ' || type from flyway_schema_history where success order by installed_rank""",
                String.class);
    }

    private static List<String> columns(String database) {
        return jdbc(database).queryForList("""
                select table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable
                from information_schema.columns
                where table_schema = 'public' and table_name <> 'flyway_schema_history' order by 1""", String.class);
    }

    /** Every message in an exception's cause chain, so a test can look for what the developer would read. */
    private static String messages(Throwable e) {
        List<String> out = new ArrayList<>();
        for (Throwable t = e; t != null; t = t.getCause()) {
            out.add(String.valueOf(t.getMessage()));
        }
        return String.join("\n", out);
    }

    @Test
    void anEmptyDatabaseGetsTheWholeSchemaFromTheMigrationsAndHibernateOnlyValidates() {
        String db = TestDatabases.newDatabase("fresh");
        try (ConfigurableApplicationContext app = boot(db)) {
            assertThat(app.getEnvironment().getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        }
        assertThat(history(db)).containsExactly("1 SQL");
        assertThat(columns(db)).contains("texts.title character varying NO", "users.email character varying NO");
    }

    @Test
    void aDatabaseHibernateBuiltIsAdoptedAtV1WithoutChanges() {
        String db = TestDatabases.newDatabase("adopted");
        try (ConfigurableApplicationContext app = boot(db, "spring.flyway.enabled=false",
                "spring.jpa.hibernate.ddl-auto=update", "app.seed-samples=true")) {
            assertThat(app).isNotNull();
        }
        List<String> before = columns(db);
        Integer texts = jdbc(db).queryForObject("select count(*) from texts", Integer.class);
        assertThat(texts).isPositive();

        try (ConfigurableApplicationContext app = boot(db)) {
            assertThat(app).isNotNull();
        }

        assertThat(history(db)).containsExactly("1 BASELINE");
        assertThat(columns(db)).isEqualTo(before);
        assertThat(jdbc(db).queryForObject("select count(*) from texts", Integer.class)).isEqualTo(texts);
    }

    @Test
    void aMissingColumnStopsStartupNamingTheTableAndColumn() {
        String db = TestDatabases.newDatabase("missing");
        flyway(db, "latest").migrate();
        jdbc(db).execute("alter table users drop column timezone");

        assertThatThrownBy(() -> boot(db)).satisfies(e -> assertThat(messages(e))
                .contains("missing column [timezone] in table [users]"));
    }

    @Test
    void aColumnOfAnotherTypeStopsStartupNamingTheTableAndColumn() {
        String db = TestDatabases.newDatabase("wrongtype");
        flyway(db, "latest").migrate();
        jdbc(db).execute("alter table texts alter column word_count type varchar(12)");

        assertThatThrownBy(() -> boot(db)).satisfies(e -> assertThat(messages(e))
                .contains("column [word_count] in table [texts]"));
    }

    @Test
    void onlyTheMigrationsADatabaseHasNotRunRunInOrderAndAreRecorded() throws IOException {
        migration("V2__add_two.sql", "create table extra_two (id int);");
        migration("V3__add_three.sql", "create table extra_three (id int);");
        String db = TestDatabases.newDatabase("upgrade");
        flyway(db, "2").migrate();
        String v2RanAt = jdbc(db).queryForObject("select installed_on::text from flyway_schema_history where version = '2'",
                String.class);

        try (ConfigurableApplicationContext app = boot(db, withExtra())) {
            assertThat(app).isNotNull();
        }

        assertThat(history(db)).containsExactly("1 SQL", "2 SQL", "3 SQL");
        assertThat(jdbc(db).queryForObject("select installed_on::text from flyway_schema_history where version = '2'",
                String.class)).isEqualTo(v2RanAt);
        assertThat(jdbc(db).queryForObject(
                "select count(*) from flyway_schema_history where version = '3' and installed_on is not null"
                        + " and checksum is not null", Integer.class)).isEqualTo(1);
    }

    @Test
    void editingAMigrationThatAlreadyRanStopsStartup() throws IOException {
        migration("V2__add_two.sql", "create table extra_two (id int);");
        String db = TestDatabases.newDatabase("edited");
        flyway(db, "latest").migrate();
        migration("V2__add_two.sql", "create table extra_two (id bigint);");

        assertThatThrownBy(() -> boot(db, withExtra())).satisfies(e -> assertThat(messages(e))
                .contains("checksum mismatch").contains("version 2"));
    }

    @Test
    void aMigrationThatFailsHalfwayLeavesTheDatabaseAsItWasAndStopsStartup() throws IOException {
        migration("V2__half_done.sql", """
                create table half_done (id int);
                insert into half_done values (1);
                alter table users add column half_done_flag boolean;
                select 1 / 0;""");
        String db = TestDatabases.newDatabase("failing");
        flyway(db, "1").migrate();

        assertThatThrownBy(() -> boot(db, withExtra())).satisfies(e -> assertThat(messages(e)).contains("V2__half_done"));

        assertThat(history(db)).containsExactly("1 SQL");
        assertThat(jdbc(db).queryForObject("select count(*) from flyway_schema_history where version = '2'",
                Integer.class)).isZero();
        assertThat(columns(db)).noneMatch(c -> c.startsWith("half_done.") || c.startsWith("users.half_done_flag"));
    }
}
