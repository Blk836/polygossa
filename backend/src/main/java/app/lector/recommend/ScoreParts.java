package app.lector.recommend;

/**
 * A ranked card's unweighted score parts, sent with the card and logged back with its impression so weights can be
 * learned. Boxed: an event may leave a part out, which makes the whole batch invalid.
 */
public record ScoreParts(Double interest, Double topic, Double comprehension, Double level, Double popular,
                         Double fresh, Double format) {

    static final double MIN = -1;
    static final double MAX = 50;

    static ScoreParts of(Scoring.Parts p) {
        return new ScoreParts(p.interest(), p.topic(), p.comprehension(), p.level(), p.popular(), p.fresh(),
                p.format());
    }

    Double[] boxed() {
        return new Double[] {interest, topic, comprehension, level, popular, fresh, format};
    }

    /** All seven present, each in [-1, 50]. */
    boolean valid() {
        for (Double v : boxed()) {
            if (v == null || v.isNaN() || v < MIN || v > MAX) {
                return false;
            }
        }
        return true;
    }

    double[] values() {
        Double[] b = boxed();
        double[] out = new double[b.length];
        for (int i = 0; i < b.length; i++) {
            out[i] = b[i];
        }
        return out;
    }
}
