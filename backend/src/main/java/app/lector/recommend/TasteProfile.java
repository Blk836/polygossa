package app.lector.recommend;

import app.lector.text.Category;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

public final class TasteProfile {

    public record Engaged(double weight, float[] vector, List<String> topics, Category category, boolean video,
                          int wordCount) {}

    static final double INTEREST = 2;
    private static final String CATEGORY = "category:";

    private final float[] taste;
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

    public float[] taste() {
        return taste;
    }

    public boolean hasTopics() {
        return maxAbs > 0;
    }

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

    public boolean inTopics(Collection<String> tags, Category category) {
        return affinity(tags, category) > 0;
    }

    public Optional<String> strongestTopic() {
        return topicsByStrength().stream().findFirst();
    }

    public Optional<Category> strongestCategory() {
        return categoriesByStrength().stream().findFirst();
    }

    public List<String> topicsByStrength() {
        return byStrength(false, Map.Entry.comparingByKey());
    }

    public List<Category> categoriesByStrength() {
        return byStrength(true, Comparator.comparing((Map.Entry<String, Double> e) -> category(e.getKey())))
                .stream().map(TasteProfile::category).toList();
    }

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
