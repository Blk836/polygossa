package app.lector.recommend;

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
