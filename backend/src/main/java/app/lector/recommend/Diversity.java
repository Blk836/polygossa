package app.lector.recommend;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * Re-ranks scored candidates into a feed with variety: no more than {@code maxRun} items in a row from one category or
 * one creator while others remain, and every {@code exploreEvery}-th slot given to the best candidate outside the
 * learner's usual topics (by its explore score), so the feed doesn't narrow to one subject. Deterministic: equal
 * scores keep their input order.
 */
public final class Diversity {

    /** A candidate with what the re-ranking needs; {@code creator} may be null (never clashes). */
    public record Slot<T>(T value, String category, Long creator, double score, double exploreScore,
                          boolean outsideTopics) {}

    private Diversity() {}

    /** Up to {@code size} values in feed order; {@code exploreEvery} 0 turns exploration off. */
    public static <T> List<T> arrange(List<Slot<T>> candidates, int size, int exploreEvery, int maxRun) {
        List<Slot<T>> byScore = new ArrayList<>(candidates);
        byScore.sort(Comparator.comparingDouble((Slot<T> s) -> s.score()).reversed());
        List<Slot<T>> byExplore = new ArrayList<>(candidates);
        byExplore.sort(Comparator.comparingDouble((Slot<T> s) -> s.exploreScore()).reversed());
        List<Slot<T>> feed = new ArrayList<>();
        while (feed.size() < size && !byScore.isEmpty()) {
            boolean explore = exploreEvery > 0 && (feed.size() + 1) % exploreEvery == 0;
            List<Slot<T>> pool = explore ? explorePool(byExplore) : byScore;
            Slot<T> next = pick(pool, feed, maxRun);
            feed.add(next);
            byScore.remove(next);
            byExplore.remove(next);
        }
        return feed.stream().map(Slot::value).toList();
    }

    private static <T> List<Slot<T>> explorePool(List<Slot<T>> byExplore) {
        List<Slot<T>> outside = byExplore.stream().filter(Slot::outsideTopics).toList();
        return outside.isEmpty() ? byExplore : outside;
    }

    /** The first in the pool that doesn't extend a run too far; the first of all when every one would. */
    private static <T> Slot<T> pick(List<Slot<T>> pool, List<Slot<T>> feed, int maxRun) {
        for (Slot<T> s : pool) {
            if (!run(feed, maxRun, s, Slot::category) && !run(feed, maxRun, s, Slot::creator)) {
                return s;
            }
        }
        return pool.getFirst();
    }

    /** Whether the last {@code maxRun} items all share this candidate's key. */
    private static <T> boolean run(List<Slot<T>> feed, int maxRun, Slot<T> next, Function<Slot<T>, Object> key) {
        Object k = key.apply(next);
        if (k == null || feed.size() < maxRun) {
            return false;
        }
        for (Slot<T> s : feed.subList(feed.size() - maxRun, feed.size())) {
            if (!Objects.equals(key.apply(s), k)) {
                return false;
            }
        }
        return true;
    }
}
