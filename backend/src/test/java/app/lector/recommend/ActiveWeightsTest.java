package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;

/** recommendation-learning.feature: which weights ranking uses. */
class ActiveWeightsTest {

    static final Weights CONFIGURED = WeightLearnerTest.CONFIGURED;
    static final Weights LEARNED = new Weights(0, 0, 4.15, 0, 0, 0, 0);

    @Test
    void rankingUsesTheAppsPropertiesWithTheCurrentWeights() {
        RecommendProperties props = new RecommendProperties(CONFIGURED, 30, 7, 2, 12, 8, 0.2, false,
                java.time.Duration.ofSeconds(60), 20, new RecommendProperties.Learn(true, 28, "open", false));
        ActiveWeights active = new ActiveWeights(props);
        assertThat(active.configured()).isEqualTo(CONFIGURED);
        assertThat(active.ranking()).isEqualTo(props);
        active.update(Optional.of(LEARNED));
        assertThat(active.ranking().weights()).isEqualTo(LEARNED);
        assertThat(active.ranking().shelfSize()).isEqualTo(8);
    }

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
