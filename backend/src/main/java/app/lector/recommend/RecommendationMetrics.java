package app.lector.recommend;

import app.lector.common.ApiException;
import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.recommend.RecommendationEventRepository.Opened;
import app.lector.session.ReadingSessionRepository;
import app.lector.vocab.VocabularyRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Whether recommendations work, across all learners: per shelf, how often shown items are opened and how far opened
 * items are read; and how fast learners who use Explore's recommendations a lot learn words, against the rest.
 * Only aggregates, and a group's growth is left out below {@link #MIN_GROUP} learners.
 */
@Service
public class RecommendationMetrics {

    static final int MIN_GROUP = 5;
    /** Opens in the window that make a learner a heavy user of recommendations. */
    static final int HEAVY_OPENS = 5;

    /** readHalf and finished are shares of the distinct items opened (null when none were). */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record ShelfMetrics(ShelfId shelf, long impressions, long opens, double clickThrough, long opened,
                               Double readHalf, Double finished) {}

    public record Group(int learners, double knownWordsPerWeek) {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Growth(Group heavy, Group light) {}

    public record Metrics(int days, List<ShelfMetrics> shelves, Growth growth) {}

    private final RecommendationEventRepository events;
    private final ReadingProgressRepository progress;
    private final ReadingSessionRepository sessions;
    private final VocabularyRepository vocabulary;
    private final Clock clock;

    public RecommendationMetrics(RecommendationEventRepository events, ReadingProgressRepository progress,
                                 ReadingSessionRepository sessions, VocabularyRepository vocabulary, Clock clock) {
        this.events = events;
        this.progress = progress;
        this.sessions = sessions;
        this.vocabulary = vocabulary;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Metrics metrics(int days) {
        if (days < 1 || days > 365) {
            throw ApiException.badRequest("days must be 1 to 365");
        }
        Instant since = clock.instant().minus(Duration.ofDays(days));
        return new Metrics(days, shelves(since), growth(since, days));
    }

    private List<ShelfMetrics> shelves(Instant since) {
        Map<String, long[]> counts = new HashMap<>();
        for (var c : events.countByShelf(since)) {
            counts.computeIfAbsent(c.getShelf(), s -> new long[2])[c.getType().ordinal()] += c.getCount();
        }
        List<Opened> opened = events.opened(since);
        Map<String, ReadingProgress> reached = reached(opened);
        List<ShelfMetrics> out = new ArrayList<>();
        for (ShelfId shelf : ShelfId.values()) {
            long[] c = counts.getOrDefault(shelf.code(), new long[2]);
            List<Opened> mine = opened.stream().filter(o -> o.getShelf().equals(shelf.code())).toList();
            long half = mine.stream().filter(o -> percent(reached, o) >= 50).count();
            long done = mine.stream().filter(o -> finished(reached, o)).count();
            out.add(new ShelfMetrics(shelf, c[0], c[1], c[0] == 0 ? 0 : (double) c[1] / c[0], mine.size(),
                    share(half, mine.size()), share(done, mine.size())));
        }
        return out;
    }

    /** Progress of each (learner, text) opened, keyed "user:text". */
    private Map<String, ReadingProgress> reached(List<Opened> opened) {
        if (opened.isEmpty()) {
            return Map.of();
        }
        Set<Long> users = opened.stream().map(Opened::getUserId).collect(Collectors.toSet());
        Set<Long> textIds = opened.stream().map(Opened::getTextId).collect(Collectors.toSet());
        return progress.findForUsersAndTexts(users, textIds).stream()
                .collect(Collectors.toMap(p -> p.getUserId() + ":" + p.getTextId(), p -> p));
    }

    private static int percent(Map<String, ReadingProgress> reached, Opened o) {
        ReadingProgress p = reached.get(o.getUserId() + ":" + o.getTextId());
        return p == null ? 0 : p.getPercent();
    }

    private static boolean finished(Map<String, ReadingProgress> reached, Opened o) {
        ReadingProgress p = reached.get(o.getUserId() + ":" + o.getTextId());
        return p != null && p.isCompleted();
    }

    private static Double share(long part, long whole) {
        return whole == 0 ? null : (double) part / whole;
    }

    /** Known words gained per week by active learners, split by how much they open recommendations. */
    private Growth growth(Instant since, int days) {
        Map<Long, Long> opens = events.opensByUser(since).stream()
                .collect(Collectors.toMap(RecommendationEventRepository.UserCount::getUserId,
                        RecommendationEventRepository.UserCount::getCount));
        Map<Long, Long> known = vocabulary.knownSinceByUser(since).stream()
                .collect(Collectors.toMap(VocabularyRepository.UserCount::getUserId, VocabularyRepository.UserCount::getCount));
        List<Long> heavy = new ArrayList<>();
        List<Long> light = new ArrayList<>();
        for (Long user : sessions.activeUserIds(since)) {
            (opens.getOrDefault(user, 0L) >= HEAVY_OPENS ? heavy : light).add(user);
        }
        double weeks = days / 7.0;
        return new Growth(group(heavy, known, weeks), group(light, known, weeks));
    }

    private static Group group(List<Long> users, Map<Long, Long> known, double weeks) {
        if (users.size() < MIN_GROUP) {
            return null;
        }
        double total = users.stream().mapToLong(u -> known.getOrDefault(u, 0L)).sum();
        return new Group(users.size(), total / users.size() / weeks);
    }
}
