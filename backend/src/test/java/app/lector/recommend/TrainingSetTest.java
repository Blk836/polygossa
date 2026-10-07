package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** recommendation-learning.feature: one training example per learner and item. */
class TrainingSetTest {

    static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");

    private static TrainingSet.Event impression(long user, long text, int position, int minute, double value) {
        return new TrainingSet.Event(user, text, false, position, new double[] {value, 0, 0, 0, 0, 0, 0},
                T0.plusSeconds(60L * minute));
    }

    private static TrainingSet.Event open(long user, long text, int minute) {
        return new TrainingSet.Event(user, text, true, 0, null, T0.plusSeconds(60L * minute));
    }

    @Test
    void oneExamplePerLearnerAndItem() {
        List<TrainingSet.Event> events = List.of(
                impression(1, 10, 3, 0, 0.1), impression(1, 10, 2, 5, 0.2), open(1, 10, 6), impression(1, 10, 1, 9, 0.3),
                impression(1, 20, 4, 0, 0.4), impression(1, 20, 5, 7, 0.5),
                new TrainingSet.Event(1, 30, false, 0, null, T0)); // no parts: not used
        List<WeightLearner.Example> examples = TrainingSet.examples(events, TrainingSet.Outcome.OPEN, Map.of());
        assertThat(examples).hasSize(2);
        WeightLearner.Example a = examples.stream().filter(WeightLearner.Example::opened).findFirst().orElseThrow();
        assertThat(a.parts()[0]).isEqualTo(0.2);
        assertThat(a.position()).isEqualTo(2);
        WeightLearner.Example b = examples.stream().filter(e -> !e.opened()).findFirst().orElseThrow();
        assertThat(b.parts()[0]).isEqualTo(0.5);
        assertThat(b.position()).isEqualTo(5);
    }

    @Test
    void anOpenWithNoImpressionBeforeItIsNotAnExample() {
        assertThat(TrainingSet.examples(List.of(open(1, 10, 0), impression(1, 10, 0, 5, 0.1)),
                TrainingSet.Outcome.OPEN, Map.of())).extracting(WeightLearner.Example::opened).containsExactly(false);
    }

    @Test
    void outcomeHalfAsksForReading() {
        List<TrainingSet.Event> events = List.of(impression(1, 10, 0, 0, 0.1), open(1, 10, 1),
                impression(1, 20, 0, 0, 0.2), open(1, 20, 1), impression(1, 30, 0, 0, 0.3), open(1, 30, 1),
                impression(1, 40, 0, 0, 0.4), open(1, 40, 1));
        Map<String, TrainingSet.Reached> reached = Map.of("1:10", new TrainingSet.Reached(60, false),
                "1:20", new TrainingSet.Reached(10, true), "1:30", new TrainingSet.Reached(49, false),
                "1:40", new TrainingSet.Reached(50, false));
        List<WeightLearner.Example> examples = TrainingSet.examples(events, TrainingSet.Outcome.HALF, reached);
        assertThat(examples).extracting(e -> e.parts()[0] + ":" + e.opened())
                .containsExactlyInAnyOrder("0.1:true", "0.2:true", "0.3:false", "0.4:true");
    }
}
