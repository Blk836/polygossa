package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;

/** recommendation-learning.feature: which weights ranking uses. */
class ActiveWeightsTest {

    static final Weights CONFIGURED = WeightLearnerTest.CONFIGURED;
    static final Weights LEARNED = new Weights(0, 0, 4.15, 0, 0, 0, 0);

    @Test
    void configuredByDefaultWhateverTheDataSays() {
        ActiveWeights active = new ActiveWeights(CONFIGURED, false);
        active.update(Optional.of(LEARNED));
        assertThat(active.current()).isEqualTo(CONFIGURED);
        assertThat(active.using()).isEqualTo("configured");
        assertThat(active.learned()).contains(LEARNED);
    }

    @Test
    void learnedWhenSwitchedOnUntilARunHasNotEnoughData() {
        ActiveWeights active = new ActiveWeights(CONFIGURED, true);
        assertThat(active.current()).isEqualTo(CONFIGURED);
        active.update(Optional.of(LEARNED));
        assertThat(active.current()).isEqualTo(LEARNED);
        assertThat(active.using()).isEqualTo("learned");
        active.update(Optional.empty());
        assertThat(active.current()).isEqualTo(CONFIGURED);
        assertThat(active.using()).isEqualTo("configured");
    }
}
