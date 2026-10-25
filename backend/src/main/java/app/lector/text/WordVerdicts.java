package app.lector.text;

import app.lector.token.Language;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WordVerdicts {

    static final int CHUNK = 1_000;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public WordVerdicts(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public Map<String, Boolean> find(Language language, Collection<String> terms) {
        Map<String, Boolean> out = new HashMap<>();
        List<String> all = new ArrayList<>(terms);
        for (int i = 0; i < all.size(); i += CHUNK) {
            String[] chunk = all.subList(i, Math.min(all.size(), i + CHUNK)).toArray(String[]::new);
            jdbc.query("select term, real_word from word_verdicts where language = ? and term = any (?)",
                    rs -> {
                        out.put(rs.getString(1), rs.getBoolean(2));
                    }, language.name(), chunk);
        }
        return out;
    }

    public Set<String> notWords(Language language) {
        return new HashSet<>(jdbc.queryForList(
                "select term from word_verdicts where language = ? and not real_word", String.class, language.name()));
    }

    public void save(Language language, Map<String, Boolean> verdicts) {
        Timestamp now = Timestamp.from(clock.instant());
        List<Object[]> rows = verdicts.entrySet().stream()
                .map(e -> new Object[] {language.name(), e.getKey(), e.getValue(), now}).toList();
        jdbc.batchUpdate("insert into word_verdicts (language, term, real_word, judged_at) values (?, ?, ?, ?) "
                + "on conflict (language, term) do nothing", rows);
    }
}
