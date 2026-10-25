package app.lector.vocab;

import app.lector.token.Language;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotWordsInVocabulary {

    static final int CHUNK = 1_000;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public NotWordsInVocabulary(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public int setAside(Language language, Set<String> notWords) {
        Timestamp now = Timestamp.from(clock.instant());
        List<String> all = new ArrayList<>(notWords);
        int moved = 0;
        for (int i = 0; i < all.size(); i += CHUNK) {
            String[] chunk = all.subList(i, Math.min(all.size(), i + CHUNK)).toArray(String[]::new);
            moved += jdbc.update("""
                    update vocabulary_entries set status = 'IGNORED', set_aside_at = ?, updated_at = ?
                    where language = ? and kind = 'WORD' and status = 'KNOWN' and set_aside_at is null
                      and coalesce(btrim(note), '') = '' and coalesce(btrim(tags), '') = '' and term = any (?)
                    """, now, now, language.name(), chunk);
        }
        return moved;
    }

    public List<String> knownTerms(Language language) {
        return jdbc.queryForList("select distinct term from vocabulary_entries where language = ? and kind = 'WORD' "
                + "and status = 'KNOWN'", String.class, language.name());
    }
}
