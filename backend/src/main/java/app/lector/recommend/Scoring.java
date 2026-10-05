package app.lector.recommend;

import app.lector.text.DifficultyEstimator;
import java.time.Duration;

/** The parts of a recommendation score, each a pure function, and how they add up. */
public final class Scoring {

    /** The parts of a score; {@link #strongest} picks the one that names the card's reason. */
    public enum Part { INTEREST, TOPIC, COMPREHENSION, LEVEL, POPULAR, FRESH, FORMAT }

    /** One candidate's parts, before weighting; {@code penalty} is added as is. */
    public record Parts(double interest, double topic, double comprehension, double level, double popular,
                        double fresh, double format, double penalty) {}

    static final double PEAK_KNOWN = 95;
    /** How fast the fit falls off below and above the peak (Gaussian widths, in percentage points). */
    static final double WIDTH_BELOW = 7;
    static final double WIDTH_ABOVE = 4;

    /** Level fit by the text's level minus the reader's: the same level, one up (i+1), one down, two either way. */
    private static final double[] LEVEL_FIT = {1.0, 0.6, 0.1};
    private static final double ONE_LEVEL_DOWN = 0.4;
    private static final double NEUTRAL = 0.5;

    private Scoring() {}

    /** 1 at 95% known words, falling off faster above (little to learn) than below (frustrating). */
    public static double comprehensionFit(double knownPercent) {
        double width = knownPercent < PEAK_KNOWN ? WIDTH_BELOW : WIDTH_ABOVE;
        double d = (knownPercent - PEAK_KNOWN) / width;
        return Math.exp(-d * d);
    }

    /** How well a text's CEFR level suits a reader's; 0.5 when either is unknown. */
    public static double levelFit(String readerLevel, String textLevel) {
        int reader = readerLevel == null ? -1 : DifficultyEstimator.LEVELS.indexOf(readerLevel);
        int text = textLevel == null ? -1 : DifficultyEstimator.LEVELS.indexOf(textLevel);
        if (reader < 0 || text < 0) {
            return NEUTRAL;
        }
        int diff = text - reader;
        if (diff == -1) {
            return ONE_LEVEL_DOWN;
        }
        int distance = Math.abs(diff);
        return distance < LEVEL_FIT.length ? LEVEL_FIT[distance] : 0;
    }

    /** 1 now, halving every {@code halfLifeDays}; ages in the future count as now. */
    public static double decay(Duration age, double halfLifeDays) {
        double days = Math.max(0, age.toMillis()) / 86_400_000.0;
        return Math.pow(0.5, days / halfLifeDays);
    }

    /** Cosine similarity; 0 when either vector is missing, empty, zero or of another size. */
    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0;
        }
        double dot = 0;
        double na = 0;
        double nb = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return na == 0 || nb == 0 ? 0 : dot / Math.sqrt(na * nb);
    }

    public static double popularity(long recentLikes) {
        return Math.log1p(Math.max(0, recentLikes));
    }

    public static double score(Parts p, Weights w) {
        return w.interest() * p.interest() + w.topic() * p.topic() + exploreScore(p, w);
    }

    /** The score without interest and topics: how exploration slots rank content outside the usual topics. */
    public static double exploreScore(Parts p, Weights w) {
        return w.comprehend() * p.comprehension() + w.level() * p.level() + w.popular() * p.popular()
                + w.fresh() * p.fresh() + w.format() * p.format() + p.penalty();
    }

    /** The part that adds most to the score (the first, in {@link Part} order, on a tie). */
    public static Part strongest(Parts p, Weights w) {
        double[] weighted = weighted(p, w);
        int best = 0;
        for (int i = 1; i < weighted.length; i++) {
            if (weighted[i] > weighted[best]) {
                best = i;
            }
        }
        return Part.values()[best];
    }

    /** What each part adds to the score, in {@link Part} order. */
    public static double[] weighted(Parts p, Weights w) {
        return new double[] {w.interest() * p.interest(), w.topic() * p.topic(), w.comprehend() * p.comprehension(),
                w.level() * p.level(), w.popular() * p.popular(), w.fresh() * p.fresh(), w.format() * p.format()};
    }
}
