package app.lector.progress;

import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WordCounts {

    static final int MAX_TERM = 500;
    static final int LOOKUP_CHUNK = 1_000;

    private final JdbcTemplate jdbc;
    private final ReadingProgressRepository progress;
    private final TextService texts;

    public WordCounts(JdbcTemplate jdbc, ReadingProgressRepository progress, TextService texts) {
        this.jdbc = jdbc;
        this.progress = progress;
        this.texts = texts;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fill(Long userId) {
        if (jdbc.update("insert into word_count_fills (user_id) values (?) on conflict do nothing", userId) == 0) {
            return;
        }
        for (ReadingProgress p : progress.findAllForUser(userId)) {
            Text text = p.getText();
            int to = p.isCompleted() ? Integer.MAX_VALUE : p.getPosition();
            add(userId, text.getLanguage(), tally(texts.tokens(text), 0, to, Integer.MAX_VALUE));
        }
    }

    void add(Long userId, Language language, List<Token> tokens, int from, int to, int max) {
        add(userId, language, tally(tokens, from, to, max));
    }

    public Map<String, Long> counts(Long userId, Language language, Collection<String> terms) {
        Map<String, Long> out = new HashMap<>();
        List<String> all = List.copyOf(terms);
        for (int start = 0; start < all.size(); start += LOOKUP_CHUNK) {
            List<String> chunk = all.subList(start, Math.min(all.size(), start + LOOKUP_CHUNK));
            List<Object> args = new ArrayList<>(List.of(userId, language.name()));
            args.addAll(chunk);
            String marks = String.join(",", Collections.nCopies(chunk.size(), "?"));
            jdbc.query("select term, times from word_counts where user_id = ? and language = ? and term in (" + marks
                    + ")", rs -> {
                        out.put(rs.getString(1), rs.getLong(2));
                    }, args.toArray());
        }
        return out;
    }

    public Map<Language, Long> totals(Long userId) {
        Map<Language, Long> out = new EnumMap<>(Language.class);
        jdbc.query("select language, sum(times) from word_counts where user_id = ? group by language",
                rs -> {
                    out.put(Language.valueOf(rs.getString(1)), rs.getLong(2));
                }, userId);
        return out;
    }

    static Map<String, Long> tally(List<Token> tokens, int from, int to, int max) {
        Map<String, Long> counts = new LinkedHashMap<>();
        int words = 0;
        for (Token t : tokens) {
            if (words >= max) {
                break;
            }
            if (t.word() && t.index() >= from && t.index() < to) {
                words++;
                count(counts, t.normalized());
            }
        }
        return counts;
    }

    private static void count(Map<String, Long> counts, String term) {
        if (term != null && !term.isEmpty() && term.length() <= MAX_TERM) {
            counts.merge(term, 1L, Long::sum);
        }
    }

    private void add(Long userId, Language language, Map<String, Long> counts) {
        if (counts.isEmpty()) {
            return;
        }
        List<Object[]> rows = counts.entrySet().stream()
                .map(e -> new Object[] {userId, language.name(), e.getKey(), e.getValue()}).toList();
        jdbc.batchUpdate("insert into word_counts (user_id, language, term, times) values (?, ?, ?, ?) "
                + "on conflict (user_id, language, term) do update set times = word_counts.times + excluded.times", rows);
    }
}
