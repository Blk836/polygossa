package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Feature: Explore recommendations, scoring (docs/acceptance/explore-recommendations.feature). */
class ScoringTest {

    @ParameterizedTest
    @CsvSource({"95, 1.0", "90, 0.600", "85, 0.130", "98, 0.570", "100, 0.210", "92, 0.832", "96.5, 0.869"})
    void comprehensionFitPeaksAtNinetyFivePercentKnown(double known, double fit) {
        assertThat(Scoring.comprehensionFit(known)).isCloseTo(fit, within(0.001));
    }

    @Test
    void comprehensionFitIsAboutZeroForUnreadableText() {
        assertThat(Scoring.comprehensionFit(0)).isCloseTo(0, within(1e-9));
        assertThat(Scoring.comprehensionFit(70)).isLessThan(0.01);
    }

    @Test
    void comprehensionFitFallsFasterAboveThePeakThanBelow() {
        assertThat(Scoring.comprehensionFit(98)).isLessThan(Scoring.comprehensionFit(92));
        assertThat(Scoring.comprehensionFit(94.9)).isLessThan(1.0);
        assertThat(Scoring.comprehensionFit(95.1)).isLessThan(1.0);
    }

    @ParameterizedTest
    @CsvSource({"B1, B1, 1.0", "B1, B2, 0.6", "B1, A2, 0.4", "B1, C1, 0.1", "B1, A1, 0.1", "B1, C2, 0.0",
            "A1, C2, 0.0", "C2, A1, 0.0", "A1, A1, 1.0", "C2, C1, 0.4", "A1, A2, 0.6"})
    void levelFitAgainstTheReadingLevel(String reader, String text, double fit) {
        assertThat(Scoring.levelFit(reader, text)).isEqualTo(fit);
    }

    @Test
    void unknownLevelsAreNeutral() {
        assertThat(Scoring.levelFit(null, "B1")).isEqualTo(0.5);
        assertThat(Scoring.levelFit("B1", null)).isEqualTo(0.5);
        assertThat(Scoring.levelFit("Z9", "B1")).isEqualTo(0.5);
        assertThat(Scoring.levelFit("B1", "Z9")).isEqualTo(0.5);
    }

    @ParameterizedTest
    @CsvSource({"0, 1.0", "30, 0.5", "60, 0.25", "15, 0.7071", "-5, 1.0"})
    void recencyHalvesEveryHalfLife(long days, double factor) {
        assertThat(Scoring.decay(Duration.ofDays(days), 30)).isCloseTo(factor, within(0.0001));
    }

    @Test
    void decayUsesTheHalfLifeGiven() {
        assertThat(Scoring.decay(Duration.ofDays(10), 10)).isCloseTo(0.5, within(1e-9));
        assertThat(Scoring.decay(Duration.ofHours(12), 1)).isCloseTo(Math.sqrt(0.5), within(1e-9));
    }

    @Test
    void cosineOfVectors() {
        assertThat(Scoring.cosine(new float[] {1, 2}, new float[] {2, 4})).isCloseTo(1, within(1e-6));
        assertThat(Scoring.cosine(new float[] {1, 0}, new float[] {-1, 0})).isCloseTo(-1, within(1e-6));
        assertThat(Scoring.cosine(new float[] {1, 0}, new float[] {0, 3})).isCloseTo(0, within(1e-6));
        assertThat(Scoring.cosine(new float[] {1, 1}, new float[] {1, 0})).isCloseTo(Math.sqrt(0.5), within(1e-6));
    }

    @Test
    void cosineWithoutComparableVectorsIsZero() {
        assertThat(Scoring.cosine(null, new float[] {1})).isZero();
        assertThat(Scoring.cosine(new float[] {1}, null)).isZero();
        assertThat(Scoring.cosine(new float[] {1, 0}, new float[] {1, 0, 0})).isZero();
        assertThat(Scoring.cosine(new float[] {0, 0}, new float[] {1, 0})).isZero();
        assertThat(Scoring.cosine(new float[] {1, 0}, new float[] {0, 0})).isZero();
        assertThat(Scoring.cosine(new float[0], new float[0])).isZero();
    }

    @Test
    void popularityIsTheLogOfRecentLikes() {
        assertThat(Scoring.popularity(0)).isZero();
        assertThat(Scoring.popularity(3)).isCloseTo(Math.log(4), within(1e-9));
        assertThat(Scoring.popularity(-2)).isZero();
    }

    @Test
    void theScoreIsTheWeightedSumPlusThePenalty() {
        var w = new Weights(2, 3, 5, 7, 11, 13, 17);
        assertThat(Scoring.score(new Scoring.Parts(1, 0, 0, 0, 0, 0, 0, 0), w)).isEqualTo(2);
        assertThat(Scoring.score(new Scoring.Parts(0, 1, 0, 0, 0, 0, 0, 0), w)).isEqualTo(3);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 1, 0, 0, 0, 0, 0), w)).isEqualTo(5);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 0, 1, 0, 0, 0, 0), w)).isEqualTo(7);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 0, 0, 1, 0, 0, 0), w)).isEqualTo(11);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 0, 0, 0, 1, 0, 0), w)).isEqualTo(13);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 0, 0, 0, 0, 1, 0), w)).isEqualTo(17);
        assertThat(Scoring.score(new Scoring.Parts(0, 0, 0, 0, 0, 0, 0, -0.5), w)).isEqualTo(-0.5);
        assertThat(Scoring.score(new Scoring.Parts(1, 1, 1, 1, 1, 1, 1, -1), w)).isEqualTo(57);
    }

    @Test
    void theExploreScoreLeavesOutInterestAndTopics() {
        var w = new Weights(2, 3, 5, 7, 11, 13, 17);
        assertThat(Scoring.exploreScore(new Scoring.Parts(1, 1, 1, 1, 1, 1, 1, -1), w)).isEqualTo(52);
    }

    @Test
    void theStrongestPartNamesTheReason() {
        var w = new Weights(1, 1, 1, 1, 1, 1, 1);
        assertThat(Scoring.strongest(new Scoring.Parts(0.9, 0.1, 0.2, 0.3, 0.1, 0.1, 0, 0), w))
                .isEqualTo(Scoring.Part.INTEREST);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.9, 0.2, 0.3, 0.1, 0.1, 0, 0), w))
                .isEqualTo(Scoring.Part.TOPIC);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.1, 0.9, 0.3, 0.1, 0.1, 0, 0), w))
                .isEqualTo(Scoring.Part.COMPREHENSION);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.1, 0.2, 0.9, 0.1, 0.1, 0, 0), w))
                .isEqualTo(Scoring.Part.LEVEL);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.1, 0.2, 0.3, 0.9, 0.1, 0, 0), w))
                .isEqualTo(Scoring.Part.POPULAR);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.1, 0.2, 0.3, 0.1, 0.9, 0, 0), w))
                .isEqualTo(Scoring.Part.FRESH);
        assertThat(Scoring.strongest(new Scoring.Parts(0.1, 0.1, 0.2, 0.3, 0.1, 0.1, 0.9, 0), w))
                .isEqualTo(Scoring.Part.FORMAT);
    }

    @Test
    void theReasonWeighsEachPart() {
        var w = new Weights(1, 1, 0.1, 1, 1, 1, 1);
        assertThat(Scoring.strongest(new Scoring.Parts(0.2, 0, 0.9, 0, 0, 0, 0, 0), w))
                .isEqualTo(Scoring.Part.INTEREST);
    }
}
