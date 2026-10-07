package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;

/** recommendation-learning.feature: fitting weights to what learners opened (logistic regression, plain code). */
class WeightLearnerTest {

    static final Weights CONFIGURED = new Weights(1.0, 0.8, 1.0, 0.6, 0.15, 0.3, 0.3);

    /** Seven parts in Scoring.Part order, each uniform in [0, 1) from a fixed seed, and a position 0-7. */
    private static List<WeightLearner.Example> examples(int n, long seed, Predicate<WeightLearner.Example> opened) {
        Random random = new Random(seed);
        List<WeightLearner.Example> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double[] parts = new double[7];
            for (int p = 0; p < 7; p++) {
                parts[p] = random.nextDouble();
            }
            WeightLearner.Example e = new WeightLearner.Example(parts, random.nextInt(8), false);
            out.add(new WeightLearner.Example(parts, e.position(), opened.test(e)));
        }
        return out;
    }

    private static double total(Weights w) {
        return w.interest() + w.topic() + w.comprehend() + w.level() + w.popular() + w.fresh() + w.format();
    }

    @Test
    void theFitFindsWhatPredictsOpening() {
        List<WeightLearner.Example> data = examples(400, 1, e -> e.parts()[2] > 0.5);
        Optional<Weights> learned = WeightLearner.learn(data, CONFIGURED);
        assertThat(learned).isPresent();
        Weights w = learned.get();
        assertThat(w.comprehend()).isGreaterThan(Math.max(w.interest(), Math.max(w.topic(), w.level())));
        assertThat(w.comprehend()).isGreaterThan(Math.max(w.popular(), Math.max(w.fresh(), w.format())));
        assertThat(WeightLearner.learn(data, CONFIGURED)).isEqualTo(learned);
    }

    @Test
    void positionIsControlledFor() {
        List<WeightLearner.Example> data = examples(400, 2, e -> e.position() == 0);
        assertThat(WeightLearner.learn(data, CONFIGURED)).isEmpty();
    }

    @Test
    void onlyClearEvidenceEarnsAWeightAndNegativeEffectsEarnNothing() {
        // Comprehension drives opening; level counts against it (opened only when level is low).
        List<WeightLearner.Example> data = examples(600, 3, e -> e.parts()[2] > 0.4 && e.parts()[3] < 0.7);
        Weights w = WeightLearner.learn(data, CONFIGURED).orElseThrow();
        assertThat(w.level()).isZero();
        assertThat(w.interest()).isZero(); // pure noise
        assertThat(w.comprehend()).isPositive();
    }

    @Test
    void aPartThatNeverVariesKeepsItsConfiguredWeight() {
        List<WeightLearner.Example> data = new ArrayList<>();
        for (WeightLearner.Example e : examples(400, 4, x -> x.parts()[2] > 0.5)) {
            double[] parts = e.parts().clone();
            parts[0] = 0; // interest is 0 everywhere: nothing embedded yet
            data.add(new WeightLearner.Example(parts, e.position(), e.opened()));
        }
        Weights w = WeightLearner.learn(data, CONFIGURED).orElseThrow();
        assertThat(w.interest()).isEqualTo(CONFIGURED.interest());
    }

    @Test
    void learnedWeightsAreOnTheConfiguredScale() {
        Weights w = WeightLearner.learn(examples(400, 5, e -> e.parts()[2] + e.parts()[4] > 1), CONFIGURED)
                .orElseThrow();
        assertThat(total(w)).isCloseTo(total(CONFIGURED), org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void notEnoughData() {
        assertThat(WeightLearner.learn(examples(199, 6, e -> e.parts()[2] > 0.5), CONFIGURED)).isEmpty();
        // 400 examples but only a handful opened
        assertThat(WeightLearner.learn(examples(400, 7, e -> e.parts()[2] > 0.97), CONFIGURED)).isEmpty();
        // ... or a handful not opened
        assertThat(WeightLearner.learn(examples(400, 8, e -> e.parts()[2] > 0.03), CONFIGURED)).isEmpty();
    }

    @Test
    void noPartClearlyMatters() {
        Random coin = new Random(9);
        assertThat(WeightLearner.learn(examples(400, 9, e -> coin.nextBoolean()), CONFIGURED)).isEmpty();
    }
}
