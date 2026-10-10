package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;

class SchemaMigrationTest {

    @TempDir
    Path extra;

    private static ConfigurableApplicationContext boot(String database, String... properties) {
        Map<String, String> args = new LinkedHashMap<>(Map.of("test.database.existing", database, "server.port", "0",
                "app.seed-samples", "false", "app.storage.dir", "build/test-uploads"));
        Arrays.stream(properties).map(p -> p.split("=", 2)).forEach(p -> args.put(p[0], p[1]));
        return new SpringApplicationBuilder(LectorApplication.class).run(args.entrySet().stream()
                .map(e -> "--" + e.getKey() + "=" + e.getValue()).toArray(String[]::new));
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

    private static List<String> history(String database) {
        return jdbc(database).queryForList("""
                select version || ' ' || type from flyway_schema_history where success order by installed_rank""",
                String.class);
    }

    private static List<String> appMigrations() throws IOException {
        return Arrays.stream(new PathMatchingResourcePatternResolver().getResources("classpath:db/migration/V*__*.sql"))
                .map(r -> Integer.parseInt(r.getFilename().substring(1, r.getFilename().indexOf("__"))))
                .sorted().map(v -> v + " SQL").toList();
    }

    private static List<String> columns(String database) {
        return jdbc(database).queryForList("""
                select table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable
                from information_schema.columns
                where table_schema = 'public' and table_name <> 'flyway_schema_history' order by 1""", String.class);
    }

    private static List<String> constraints(String database) {
        return jdbc(database).queryForList("""
                select conrelid::regclass::text || ' ' || conname || ' ' || contype::text from pg_constraint
                where connamespace = 'public'::regnamespace and conrelid::regclass::text <> 'flyway_schema_history'
                order by 1""", String.class);
    }

    private static String messages(Throwable e) {
        List<String> out = new ArrayList<>();
        for (Throwable t = e; t != null; t = t.getCause()) {
            out.add(String.valueOf(t.getMessage()));
        }
        return String.join("\n", out);
    }

    @Test
    void anEmptyDatabaseGetsTheWholeSchemaFromTheMigrationsAndHibernateOnlyValidates() throws IOException {
        String db = TestDatabases.newDatabase("fresh");
        try (ConfigurableApplicationContext app = boot(db)) {
            assertThat(app.getEnvironment().getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        }
        assertThat(history(db)).isEqualTo(appMigrations());
        assertThat(columns(db)).contains("texts.title character varying NO", "users.email character varying NO");
    }

    @Test
    void aDatabaseHibernateBuiltIsAdoptedAtV1WithoutChanges() throws IOException {
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

        List<String> later = appMigrations().subList(1, appMigrations().size());
        assertThat(history(db)).first().isEqualTo("1 BASELINE");
        assertThat(history(db).subList(1, history(db).size())).isEqualTo(later);
        assertThat(columns(db)).isEqualTo(before);
        assertThat(jdbc(db).queryForObject("select count(*) from texts", Integer.class)).isEqualTo(texts);
    }

    @Test
    void anAdoptedDatabaseEndsUpWithTheSameConstraintNamesAsANewOne() {
        String fresh = TestDatabases.newDatabase("named");
        flyway(fresh, "latest").migrate();
        String db = TestDatabases.newDatabase("hashed");
        flyway(db, "1").migrate();
        jdbc(db).execute("drop table flyway_schema_history");
        jdbc(db).execute("alter table users rename constraint users_email_key to uk6dotkott2kjsp8vw4d0m25fb7");
        jdbc(db).execute("alter table texts rename constraint texts_body_id_key to ukkxr77ljwe99ccl7nkoi6k2tlj");
        jdbc(db).execute("alter table classrooms rename constraint classrooms_join_code_key to uko70sq3b5r5bqlri66mgba79as");

        try (ConfigurableApplicationContext app = boot(db)) {
            assertThat(app).isNotNull();
        }

        assertThat(constraints(db)).isEqualTo(constraints(fresh)).contains("users users_email_key u");
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
        migration("V900__add_two.sql", "create table extra_two (id int);");
        migration("V901__add_three.sql", "create table extra_three (id int);");
        String db = TestDatabases.newDatabase("upgrade");
        flyway(db, "900").migrate();
        String v900RanAt = jdbc(db).queryForObject("select installed_on::text from flyway_schema_history where version = '900'",
                String.class);

        try (ConfigurableApplicationContext app = boot(db, withExtra())) {
            assertThat(app).isNotNull();
        }

        assertThat(history(db)).endsWith("900 SQL", "901 SQL").startsWith(appMigrations().toArray(String[]::new))
                .hasSize(appMigrations().size() + 2);
        assertThat(jdbc(db).queryForObject("select installed_on::text from flyway_schema_history where version = '900'",
                String.class)).isEqualTo(v900RanAt);
        assertThat(jdbc(db).queryForObject(
                "select count(*) from flyway_schema_history where version = '901' and installed_on is not null"
                        + " and checksum is not null", Integer.class)).isEqualTo(1);
    }

    @Test
    void editingAMigrationThatAlreadyRanStopsStartup() throws IOException {
        migration("V900__add_two.sql", "create table extra_two (id int);");
        String db = TestDatabases.newDatabase("edited");
        flyway(db, "latest").migrate();
        migration("V900__add_two.sql", "create table extra_two (id bigint);");

        assertThatThrownBy(() -> boot(db, withExtra())).satisfies(e -> assertThat(messages(e))
                .contains("checksum mismatch").contains("version 900"));
    }

    @Test
    void aMigrationThatFailsHalfwayLeavesTheDatabaseAsItWasAndStopsStartup() throws IOException {
        String db = TestDatabases.newDatabase("failing");
        flyway(db, "latest").migrate();
        migration("V900__half_done.sql", """
                create table half_done (id int);
                insert into half_done values (1);
                alter table users add column half_done_flag boolean;
                select 1 / 0;""");

        assertThatThrownBy(() -> boot(db, withExtra())).satisfies(e -> assertThat(messages(e)).contains("V900__half_done"));

        assertThat(history(db)).isEqualTo(appMigrations());
        assertThat(jdbc(db).queryForObject("select count(*) from flyway_schema_history where version = '900'",
                Integer.class)).isZero();
        assertThat(columns(db)).noneMatch(c -> c.startsWith("half_done.") || c.startsWith("users.half_done_flag"));
    }
}
