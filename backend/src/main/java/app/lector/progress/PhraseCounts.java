package app.lector.progress;

import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhraseCounts {

    private record Phrase(long id, Language language, String term) {}

    private final JdbcTemplate jdbc;
    private final ReadingProgressRepository progress;
    private final TextService texts;

    public PhraseCounts(JdbcTemplate jdbc, ReadingProgressRepository progress, TextService texts) {
        this.jdbc = jdbc;
        this.progress = progress;
        this.texts = texts;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fill(Long userId) {
        List<Phrase> missing = jdbc.query("select v.id, v.language, v.term from vocabulary_entries v "
                + "left join phrase_counts p on p.entry_id = v.id "
                + "where v.user_id = ? and v.kind = 'PHRASE' and p.entry_id is null",
                (rs, n) -> new Phrase(rs.getLong(1), Language.valueOf(rs.getString(2)), rs.getString(3)), userId);
        if (missing.isEmpty()) {
            return;
        }
        Map<Long, Long> counts = new HashMap<>();
        Map<Long, List<Phrase>> byText = new HashMap<>();
        for (Phrase phrase : missing) {
            counts.put(phrase.id(), 0L);
            for (Long text : textsContaining(userId, phrase)) {
                byText.computeIfAbsent(text, t -> new ArrayList<>()).add(phrase);
            }
        }
        if (!byText.isEmpty()) {
            for (ReadingProgress p : progress.findForTexts(userId, byText.keySet())) {
                int to = p.isCompleted() ? Integer.MAX_VALUE : p.getPosition();
                tally(new PhraseMatcher(texts.tokens(p.getText())), byText.get(p.getTextId()), 0, to, counts);
            }
        }
        jdbc.batchUpdate("insert into phrase_counts (entry_id, times) values (?, ?) on conflict do nothing",
                counts.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(e -> new Object[] {e.getKey(), e.getValue()}).toList());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void add(Long userId, Language language, List<Token> tokens, int from, int to) {
        List<Phrase> phrases = jdbc.query("select v.id, v.language, v.term from vocabulary_entries v "
                + "join phrase_counts p on p.entry_id = v.id "
                + "where v.user_id = ? and v.language = ? and v.kind = 'PHRASE'",
                (rs, n) -> new Phrase(rs.getLong(1), language, rs.getString(3)), userId, language.name());
        if (phrases.isEmpty()) {
            return;
        }
        Map<Long, Long> counts = new HashMap<>();
        tally(new PhraseMatcher(tokens), phrases, from, to, counts);
        List<Object[]> rows = counts.entrySet().stream().filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new Object[] {e.getValue(), e.getKey()}).toList();
        jdbc.batchUpdate("update phrase_counts set times = times + ? where entry_id = ?", rows);
    }

    public Map<Long, Long> counts(Collection<Long> entryIds) {
        Map<Long, Long> out = new HashMap<>();
        List<Long> all = List.copyOf(entryIds);
        for (int start = 0; start < all.size(); start += WordCounts.LOOKUP_CHUNK) {
            List<Long> chunk = all.subList(start, Math.min(all.size(), start + WordCounts.LOOKUP_CHUNK));
            String marks = String.join(",", Collections.nCopies(chunk.size(), "?"));
            jdbc.query("select entry_id, times from phrase_counts where entry_id in (" + marks + ")", rs -> {
                out.put(rs.getLong(1), rs.getLong(2));
            }, new ArrayList<Object>(chunk).toArray());
        }
        return out;
    }

    private List<Long> textsContaining(Long userId, Phrase phrase) {
        return jdbc.queryForList("select p.text_id from reading_progress p join texts t on t.id = p.text_id "
                + "join text_bodies b on b.id = t.body_id where p.user_id = ? and t.language = ? "
                + "and strpos(regexp_replace(lower(replace(b.content, '’', '''')), '\\s+', ' ', 'g'), ?) > 0",
                Long.class, userId, phrase.language().name(), PhraseMatcher.normalize(phrase.term()));
    }

    private static void tally(PhraseMatcher matcher, List<Phrase> phrases, int from, int to, Map<Long, Long> counts) {
        for (Phrase p : phrases) {
            long n = matcher.ends(p.term()).stream().filter(end -> end >= from && end < to).count();
            counts.merge(p.id(), n, Long::sum);
        }
    }
}
