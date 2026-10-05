package app.lector.text;

import java.sql.PreparedStatement;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * Brings a database from before text bodies were split off up to date, first thing at startup (before seeding or the
 * annotation backfill write any text): each text's content, tokens, timings and cues move from its {@code texts} row
 * into {@code text_bodies}, the old columns are dropped, and texts without their stored distinct words get them. The
 * schema is otherwise Hibernate's {@code ddl-auto: update}, which adds the new table and columns but never moves data
 * or drops a column. Safe to run again: each step only touches what is left to do.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TextBodyMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TextBodyMigration.class);

    static final List<String> OLD_COLUMNS = List.of("content", "tokens_json", "timings_json", "cues_json");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final TextRepository texts;
    private final TextService service;
    private final ObjectMapper json;

    public TextBodyMigration(JdbcTemplate jdbc, TransactionTemplate tx, TextRepository texts, TextService service,
                             ObjectMapper json) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.texts = texts;
        this.service = service;
        this.json = json;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (hasOldColumns()) {
            moveBodies();
            for (String column : OLD_COLUMNS) {
                jdbc.execute("alter table texts drop column if exists " + column);
            }
        }
        fillWords();
    }

    private boolean hasOldColumns() {
        Integer found = jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where lower(table_name) = 'texts' and lower(column_name) = 'content'""", Integer.class);
        return found != null && found > 0;
    }

    /** One row at a time, so a large library never sits in memory at once. */
    private void moveBodies() {
        List<Long> ids = jdbc.queryForList("select id from texts where body_id is null", Long.class);
        for (Long id : ids) {
            KeyHolder key = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                PreparedStatement insert = connection.prepareStatement("""
                        insert into text_bodies (content, tokens_json, timings_json, cues_json)
                        select coalesce(content, ''), coalesce(tokens_json, '[]'), timings_json, cues_json
                        from texts where id = ?""", new String[] {"id"});
                insert.setLong(1, id);
                return insert;
            }, key);
            jdbc.update("update texts set body_id = ? where id = ?", key.getKey().longValue(), id);
        }
        log.info("Moved the content of {} texts into text_bodies", ids.size());
    }

    private void fillWords() {
        List<Long> ids = texts.findIdsWithoutWords();
        for (Long id : ids) {
            tx.executeWithoutResult(status -> texts.findById(id).ifPresent(
                    text -> text.setWordsJson(KnownWords.wordsJson(service.tokens(text), json))));
        }
        if (!ids.isEmpty()) {
            log.info("Stored the distinct words of {} texts", ids.size());
        }
    }
}
