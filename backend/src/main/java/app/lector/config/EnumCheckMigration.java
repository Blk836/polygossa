package app.lector.config;

import app.lector.text.Category;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.user.GoalKind;
import app.lector.user.Tier;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Hibernate writes a check constraint listing an enum's values when it creates an enum column, and ddl-auto update
 * never changes it, so a value added later (English) is refused by older databases. First thing at startup, every
 * single-column check constraint that lists a strict subset of one of the app's enums' values is rewritten with that
 * enum's current values (the smallest enum that holds them all). Safe to run again: up-to-date lists are left alone.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EnumCheckMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EnumCheckMigration.class);
    private static final Pattern VALUE = Pattern.compile("'([A-Z][A-Z0-9_]*)'");
    private static final List<Class<? extends Enum<?>>> ENUMS = List.of(Language.class, NativeLanguage.class,
            Tier.class, GoalKind.class, Category.class);

    private final JdbcTemplate jdbc;

    public EnumCheckMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private record Check(String table, String name, String column, String definition) {}

    @Override
    public void run(ApplicationArguments args) {
        List<Check> checks = jdbc.query("""
                select c.conrelid::regclass::text as tbl, c.conname, a.attname, pg_get_constraintdef(c.oid) as def
                from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                where c.contype = 'c' and array_length(c.conkey, 1) = 1
                  and c.connamespace = (select oid from pg_namespace where nspname = current_schema())""",
                (rs, i) -> new Check(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)));
        for (Check check : checks) {
            Set<String> listed = values(check.definition());
            current(listed).ifPresent(names -> rewrite(check, names));
        }
    }

    static Set<String> values(String definition) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = VALUE.matcher(definition);
        while (m.find()) {
            out.add(m.group(1));
        }
        return out;
    }

    /**
     * The current values of the smallest enum of which {@code listed} is a strict subset; none when the list is
     * already exactly one enum's values (the Language list is also part of the NativeLanguage list).
     */
    static Optional<List<String>> current(Set<String> listed) {
        List<List<String>> enums = ENUMS.stream()
                .map(e -> Arrays.stream(e.getEnumConstants()).map(Enum::name).toList()).toList();
        if (listed.size() < 2 || enums.stream().anyMatch(names -> Set.copyOf(names).equals(listed))) {
            return Optional.empty();
        }
        return enums.stream()
                .filter(names -> names.size() > listed.size() && names.containsAll(listed))
                .min(Comparator.comparingInt(List::size));
    }

    private void rewrite(Check check, List<String> names) {
        String list = names.stream().map(n -> "'" + n + "'").collect(Collectors.joining(", "));
        jdbc.execute("alter table " + check.table() + " drop constraint " + check.name());
        jdbc.execute("alter table " + check.table() + " add constraint " + check.name() + " check (" + check.column()
                + " in (" + list + "))");
        log.info("Brought {}.{} up to date with every allowed value", check.table(), check.name());
    }
}
