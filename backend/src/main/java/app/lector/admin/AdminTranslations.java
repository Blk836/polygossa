package app.lector.admin;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.LookupCounterRepository;
import app.lector.vocab.CommunityMeanings;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminTranslations {

    public record Day(LocalDate day, LookupSums.Layers layers, double cost) {}

    public record Report(int days, LookupPrices prices, List<LookupSums.Row> pairs, LookupSums.Row total,
                         List<Day> trend) {}

    private record Pair(String source, String target) {}

    private final LookupCounterRepository counters;
    private final LookupPrices prices;
    private final EntityManager em;
    private final Clock clock;

    public AdminTranslations(LookupCounterRepository counters, LookupPrices prices, EntityManager em, Clock clock) {
        this.counters = counters;
        this.prices = prices;
        this.em = em;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Report report(int days) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate first = today.minusDays(days - 1L);
        Map<Pair, LookupSums> pairs = new HashMap<>();
        Map<LocalDate, LookupSums> byDay = new TreeMap<>();
        for (LookupCounterRepository.Sums s : counters.since(first)) {
            pairs.computeIfAbsent(new Pair(s.getSourceLanguage(), s.getTargetLanguage()), p -> new LookupSums()).add(s);
            byDay.computeIfAbsent(s.getDay(), d -> new LookupSums()).add(s);
        }
        stored(pairs);
        LookupSums total = new LookupSums();
        pairs.values().forEach(total::add);
        List<LookupSums.Row> rows = new ArrayList<>(pairs.entrySet().stream()
                .map(e -> e.getValue().row(Language.valueOf(e.getKey().source()).code(),
                        NativeLanguage.valueOf(e.getKey().target()).code(), prices))
                .toList());
        rows.sort(Comparator.comparingLong(LookupSums.Row::lookups).reversed()
                .thenComparing(LookupSums.Row::source).thenComparing(LookupSums.Row::target));
        return new Report(days, prices, rows, total.row(null, null, prices), trend(first, today, byDay));
    }

    private List<Day> trend(LocalDate first, LocalDate today, Map<LocalDate, LookupSums> byDay) {
        List<Day> out = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(today); d = d.plusDays(1)) {
            LookupSums sums = byDay.getOrDefault(d, new LookupSums());
            out.add(new Day(d, sums.layers(), sums.cost(prices)));
        }
        return out;
    }

    private void stored(Map<Pair, LookupSums> pairs) {
        for (Object[] r : rows("""
                select source_language, target_language, count(*) from sentence_meanings
                group by source_language, target_language""")) {
            sums(pairs, r).sentenceMeanings(number(r[2]));
        }
        for (Object[] r : rows("""
                select language, meaning_language, count(distinct term) from (
                    select language, term, meaning_language from vocabulary_entries
                    where meaning is not null and meaning_language is not null
                    group by language, term, meaning_language, lower(meaning)
                    having count(*) >= %d) shared
                group by language, meaning_language""".formatted(CommunityMeanings.MIN_LEARNERS))) {
            sums(pairs, r).communityWords(number(r[2]));
        }
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql) {
        return em.createNativeQuery(sql).getResultList();
    }

    private static LookupSums sums(Map<Pair, LookupSums> pairs, Object[] row) {
        return pairs.computeIfAbsent(new Pair((String) row[0], (String) row[1]), p -> new LookupSums());
    }

    private static long number(Object n) {
        return ((Number) n).longValue();
    }
}
