package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManagerFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.flywaydb.core.Flyway;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Feature: an enum stored as text has a check constraint listing its values, so adding a value needs a migration that
 * updates that constraint. Every enum column the entities map is compared with a database built by the migrations
 * alone (no app startup that could patch it): this test fails until the migration exists.
 */
@ApiTest
class EnumColumnsMigratedTest {

    private static final Pattern VALUE = Pattern.compile("'([A-Za-z0-9_]+)'");

    @Autowired
    EntityManagerFactory entities;

    private record EnumColumn(String table, String column, Class<?> type) {
        Set<String> values() {
            Set<String> out = new LinkedHashSet<>();
            Arrays.stream(type.getEnumConstants()).forEach(c -> out.add(((Enum<?>) c).name()));
            return out;
        }
    }

    private List<EnumColumn> enumColumns() {
        List<EnumColumn> out = new ArrayList<>();
        entities.unwrap(SessionFactoryImplementor.class).getMappingMetamodel().forEachEntityDescriptor(entity ->
                entity.forEachAttributeMapping(attribute -> {
                    Class<?> type = attribute.getJavaType().getJavaTypeClass();
                    if (type.isEnum()) {
                        attribute.forEachSelectable((i, column) -> out.add(new EnumColumn(
                                column.getContainingTableExpression(), column.getSelectionExpression(), type)));
                    }
                }));
        return out;
    }

    private static JdbcTemplate migrated() {
        String db = TestDatabases.newDatabase("enums");
        Flyway.configure().dataSource(TestDatabases.dataSource(db)).load().migrate();
        return new JdbcTemplate(TestDatabases.dataSource(db));
    }

    private static Set<String> listed(JdbcTemplate db, EnumColumn column) {
        List<String> checks = db.queryForList("""
                select pg_get_constraintdef(c.oid) from pg_constraint c
                join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                where c.contype = 'c' and array_length(c.conkey, 1) = 1
                  and c.conrelid = ?::regclass and a.attname = ?""", String.class, column.table(), column.column());
        Set<String> out = new LinkedHashSet<>();
        for (String check : checks) {
            Matcher m = VALUE.matcher(check);
            while (m.find()) {
                out.add(m.group(1));
            }
        }
        return out;
    }

    /** Each enum column whose check constraint doesn't list exactly the enum's values, with what it lists. */
    private List<String> outOfDate(JdbcTemplate db) {
        return enumColumns().stream()
                .filter(c -> !listed(db, c).equals(c.values()))
                .map(c -> c.table() + "." + c.column() + " lists " + listed(db, c) + ", " + c.type().getSimpleName()
                        + " has " + c.values())
                .toList();
    }

    @Test
    void theEntitiesStoreEnumsAsText() {
        assertThat(enumColumns()).extracting(c -> c.table() + "." + c.column())
                .contains("texts.language", "texts.category", "users.tier", "users.native_language");
    }

    @Test
    void everyEnumColumnListsExactlyTheEnumsValuesAfterTheMigrations() {
        assertThat(outOfDate(migrated())).isEmpty();
    }

    @Test
    void aValueMissingFromAConstraintIsReported() {
        JdbcTemplate db = migrated();
        db.execute("alter table texts drop constraint texts_language_check");
        db.execute("alter table texts add constraint texts_language_check check (language in ('ES','FR'))");

        assertThat(outOfDate(db)).singleElement().asString().startsWith("texts.language lists [ES, FR], Language has [");
    }
}
