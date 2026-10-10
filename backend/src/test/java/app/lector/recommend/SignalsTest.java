package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SignalsTest {

    private static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");
    private static final double HALF_LIFE = 30;

    private static Signals.Activity none() {
        return new Signals.Activity(false, 0, null, null, null, 0, null, null);
    }

    private static Signals.Activity progress(int percent, boolean completed, Instant at) {
        return new Signals.Activity(completed, percent, at, null, null, 0, null, null);
    }

    private static double weight(Signals.Activity a) {
        return Signals.weight(a, NOW, HALF_LIFE);
    }

    private static Instant daysAgo(long days) {
        return NOW.minus(Duration.ofDays(days));
    }

    @Test
    void noActivityWeighsNothing() {
        assertThat(weight(none())).isZero();
    }

    @Test
    void finishingCountsThreePlusTwoForReadingHalf() {
        assertThat(weight(progress(100, true, NOW))).isEqualTo(5);
    }

    @ParameterizedTest
    @CsvSource({"50, 2", "80, 2", "49, 0", "10, 0"})
    void readingHalfWithoutFinishing(int percent, double weight) {
        assertThat(weight(progress(percent, false, NOW))).isEqualTo(weight);
    }

    @Test
    void likesAndBookmarks() {
        assertThat(weight(new Signals.Activity(false, 0, null, NOW, null, 0, null, null))).isEqualTo(3);
        assertThat(weight(new Signals.Activity(false, 0, null, null, NOW, 0, null, null))).isEqualTo(2);
        assertThat(weight(new Signals.Activity(false, 0, null, NOW, NOW, 0, null, null))).isEqualTo(5);
    }

    @ParameterizedTest
    @CsvSource({"0, 0", "599, 0", "600, 1", "1500, 2", "1799, 2", "1800, 3", "7200, 3"})
    void onePointPerTenMinutesCappedAtThree(long seconds, double weight) {
        assertThat(weight(new Signals.Activity(false, 0, null, null, null, seconds, NOW, null))).isEqualTo(weight);
    }

    @Test
    void timeWithoutASessionDateCountsUndecayed() {
        assertThat(weight(new Signals.Activity(false, 0, null, null, null, 1200, null, null))).isEqualTo(2);
    }

    @Test
    void notInterestedCountsMinusFour() {
        assertThat(weight(new Signals.Activity(false, 0, null, null, null, 0, null, NOW))).isEqualTo(-4);
    }

    @Test
    void abandonedAfterSevenDaysUnderTenPercent() {
        assertThat(weight(progress(9, false, daysAgo(7)))).isEqualTo(-1);
        assertThat(weight(progress(0, false, daysAgo(7)))).isEqualTo(-1);
        assertThat(weight(progress(9, false, daysAgo(6)))).isZero();
        assertThat(weight(progress(10, false, daysAgo(30)))).isZero();
        assertThat(weight(progress(9, true, daysAgo(30)))).isCloseTo(1.5, within(1e-9));
    }

    @Test
    void abandonmentDecaysFromWhenItBecameAbandoned() {
        assertThat(weight(progress(5, false, daysAgo(37)))).isCloseTo(-0.5, within(1e-9));
    }

    @Test
    void abandonedRequiresAProgressDate() {
        assertThat(Signals.abandoned(5, false, null, NOW)).isFalse();
        assertThat(Signals.abandoned(5, false, daysAgo(7), NOW)).isTrue();
        assertThat(Signals.abandoned(5, false, daysAgo(7).plusSeconds(1), NOW)).isFalse();
    }

    @Test
    void signalsDecayWithAThirtyDayHalfLife() {
        assertThat(weight(new Signals.Activity(false, 0, null, daysAgo(30), null, 0, null, null))).isCloseTo(1.5, within(1e-9));
        assertThat(weight(new Signals.Activity(false, 0, null, daysAgo(60), null, 0, null, null))).isCloseTo(0.75, within(1e-9));
        assertThat(weight(progress(100, true, daysAgo(30)))).isCloseTo(2.5, within(1e-9));
        assertThat(weight(new Signals.Activity(false, 0, null, null, daysAgo(30), 0, null, null))).isCloseTo(1, within(1e-9));
        assertThat(weight(new Signals.Activity(false, 0, null, null, null, 600, daysAgo(30), null))).isCloseTo(0.5, within(1e-9));
        assertThat(weight(new Signals.Activity(false, 0, null, null, null, 0, null, daysAgo(30)))).isCloseTo(-2, within(1e-9));
    }

    @ParameterizedTest
    @CsvSource({"0, 0, 0", "4, 0, 0", "5, 0, -0.5", "9, 0, -0.5", "10, 0, -1", "50, 0, -1", "10, 1, 0", "5, 2, 0"})
    void shownManyTimesAndNeverOpened(int impressions, int opens, double penalty) {
        assertThat(Signals.impressionPenalty(impressions, opens)).isEqualTo(penalty);
    }
}
