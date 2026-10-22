package app.lector.vocab;

import app.lector.progress.PhraseCounts;
import app.lector.progress.WordCounts;
import app.lector.token.Language;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class TimesMet {

    private final WordCounts counts;
    private final PhraseCounts phrases;

    public TimesMet(WordCounts counts, PhraseCounts phrases) {
        this.counts = counts;
        this.phrases = phrases;
    }

    public void fill(Long userId) {
        counts.fill(userId);
        phrases.fill(userId);
    }

    public Map<Long, VocabularyDto.Met> of(Long userId, Collection<VocabularyEntry> entries) {
        fill(userId);
        Map<Long, VocabularyDto.Met> out = phraseCounts(entries);
        Map<Language, Long> totals = counts.totals(userId);
        Map<Language, List<VocabularyEntry>> words = entries.stream().filter(e -> e.getKind() == EntryKind.WORD)
                .collect(Collectors.groupingBy(VocabularyEntry::getLanguage));
        words.forEach((language, list) -> {
            Map<String, Long> found = counts.counts(userId, language, list.stream().map(VocabularyEntry::getTerm).toList());
            long total = totals.getOrDefault(language, 0L);
            for (VocabularyEntry e : list) {
                long count = found.getOrDefault(e.getTerm(), 0L);
                out.put(e.getId(), new VocabularyDto.Met(count, total == 0 ? 0.0 : (double) count / total));
            }
        });
        return out;
    }

    private Map<Long, VocabularyDto.Met> phraseCounts(Collection<VocabularyEntry> entries) {
        List<Long> ids = entries.stream().filter(e -> e.getKind() == EntryKind.PHRASE).map(VocabularyEntry::getId)
                .toList();
        Map<Long, Long> found = phrases.counts(ids);
        Map<Long, VocabularyDto.Met> out = new HashMap<>();
        ids.forEach(id -> out.put(id, new VocabularyDto.Met(found.getOrDefault(id, 0L), null)));
        return out;
    }

    public static List<VocabularyEntry> mostMet(List<VocabularyEntry> entries, Map<Long, VocabularyDto.Met> met,
                                                Integer limit) {
        Comparator<VocabularyEntry> order = Comparator
                .comparingLong((VocabularyEntry e) -> met.get(e.getId()).count()).reversed()
                .thenComparing(VocabularyEntry::getTerm);
        return entries.stream().filter(e -> e.getKind() == EntryKind.WORD).sorted(order)
                .limit(limit == null || limit < 1 ? Long.MAX_VALUE : limit).toList();
    }
}
