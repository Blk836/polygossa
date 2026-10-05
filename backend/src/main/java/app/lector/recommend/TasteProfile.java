package app.lector.recommend;

import app.lector.text.Category;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

/**
 * What a learner likes, from the texts they engaged with (any language) and the categories they picked as interests:
 * a taste vector for embedding similarity, weights per topic tag and category, and the formats they enjoy.
 */
public final class TasteProfile {

    /** A text the learner did something with, and its signal weight (negative: disliked). */
    public record Engaged(double weight, float[] vector, List<String> topics, Category category, boolean video,
                          int wordCount) {}

    /** Each picked interest counts like this much engagement with its category. */
    static final double INTEREST = 2;
    private static final String CATEGORY = "category:";

    private final float[] taste;
    /** Topic tags and "category:<code>" keys, sorted so ties resolve the same way every time. */
    private final Map<String, Double> weights = new TreeMap<>();
    private final double maxAbs;
    private final double[] kind = new double[2];
    private final double[] length = new double[3];
    private final double positive;

    private TasteProfile(List<Engaged> engaged, Set<Category> interests, List<float[]> interestVectors) {
        float[] fromHistory = average(engaged.stream().filter(e -> e.weight() > 0 && e.vector() != null)
                .map(e -> new Weighted(e.vector(), e.weight())).toList());
        this.taste = fromHistory != null ? fromHistory
                : average(interestVectors.stream().map(v -> new Weighted(v, 1)).toList());
        double total = 0;
        for (Engaged e : engaged) {
            for (String topic : e.topics()) {
                weights.merge(topic, e.weight(), Double::sum);
            }
            weights.merge(key(e.category()), e.weight(), Double::sum);
            if (e.weight() > 0) {
                kind[e.video() ? 1 : 0] += e.weight();
                length[bucket(e.wordCount())] += e.weight();
                total += e.weight();
            }
        }
        for (Category c : interests) {
            weights.merge(key(c), INTEREST, Double::sum);
        }
        this.positive = total;
        this.maxAbs = weights.values().stream().mapToDouble(Math::abs).max().orElse(0);
    }

    public static TasteProfile of(List<Engaged> engaged, Set<Category> interests, List<float[]> interestVectors) {
        return new TasteProfile(engaged, interests, interestVectors);
    }

    /** The taste vector, or null when there is nothing to base it on. */
    public float[] taste() {
        return taste;
    }

    public boolean hasTopics() {
        return maxAbs > 0;
    }

    /** Mean normalised weight (-1…1) of the item's tags and category; 0 without any topic history. */
    public double affinity(Collection<String> tags, Category category) {
        if (!hasTopics()) {
            return 0;
        }
        double sum = weights.getOrDefault(key(category), 0.0);
        for (String tag : tags) {
            sum += weights.getOrDefault(tag, 0.0);
        }
        return sum / maxAbs / (tags.size() + 1);
    }

    /** Whether the item is in the learner's usual topics (positive affinity). */
    public boolean inTopics(Collection<String> tags, Category category) {
        return affinity(tags, category) > 0;
    }

    public Optional<String> strongestTopic() {
        return topicsByStrength().stream().findFirst();
    }

    public Optional<Category> strongestCategory() {
        return categoriesByStrength().stream().findFirst();
    }

    /** Tags with a positive weight, strongest first (alphabetical on a tie). */
    public List<String> topicsByStrength() {
        return byStrength(false, Map.Entry.comparingByKey());
    }

    /** Categories with a positive weight, strongest first (shelf order on a tie). */
    public List<Category> categoriesByStrength() {
        return byStrength(true, Comparator.comparing((Map.Entry<String, Double> e) -> category(e.getKey())))
                .stream().map(TasteProfile::category).toList();
    }

    /** Of these tags, the one the learner likes most, if they like any. */
    public Optional<String> favouriteTag(Collection<String> tags) {
        return topicsByStrength().stream().filter(tags::contains).findFirst();
    }

    private List<String> byStrength(boolean categories, Comparator<Map.Entry<String, Double>> tieBreak) {
        Comparator<Map.Entry<String, Double>> byWeight = Map.Entry.comparingByValue();
        return weights.entrySet().stream()
                .filter(e -> e.getKey().startsWith(CATEGORY) == categories && e.getValue() > 0)
                .sorted(byWeight.reversed().thenComparing(tieBreak)).map(Map.Entry::getKey).toList();
    }

    private static Category category(String key) {
        return Category.parse(key.substring(CATEGORY.length()));
    }

    /** -1…1: how much more the learner enjoyed this kind (video or text) and length than the others. */
    public double formatAffinity(boolean video, int wordCount) {
        if (positive <= 0) {
            return 0;
        }
        double sameKind = kind[video ? 1 : 0];
        double sameLength = length[bucket(wordCount)];
        return ((2 * sameKind - positive) / positive + (2 * sameLength - positive) / positive) / 2;
    }

    static int bucket(int wordCount) {
        if (wordCount < 300) {
            return 0;
        }
        return wordCount < 1500 ? 1 : 2;
    }

    private static String key(Category category) {
        return CATEGORY + category.code();
    }

    private record Weighted(float[] vector, double weight) {}

    /** Weighted average of the vectors the same size as the first; null when there are none. */
    private static float[] average(List<Weighted> items) {
        if (items.isEmpty()) {
            return null;
        }
        int size = items.getFirst().vector().length;
        double[] sum = new double[size];
        double total = 0;
        for (Weighted w : items) {
            if (w.vector().length != size) {
                continue;
            }
            for (int i = 0; i < size; i++) {
                sum[i] += w.vector()[i] * w.weight();
            }
            total += w.weight();
        }
        float[] out = new float[size];
        for (int i = 0; i < size; i++) {
            out[i] = (float) (sum[i] / total);
        }
        return out;
    }
}
