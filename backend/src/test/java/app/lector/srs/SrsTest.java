package app.lector.srs;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SrsTest {

    private final Instant now = Instant.parse("2026-01-01T12:00:00Z");

    @Test
    void easyProgressesOneThreeThenMultipliesByEase() {
        SrsState s = new SrsState();
        SrsScheduler.apply(s, Rating.EASY, now);
        assertThat(s.getIntervalDays()).isEqualTo(1);
        assertThat(s.getDueAt()).isEqualTo(now.plus(Duration.ofDays(1)));
        SrsScheduler.apply(s, Rating.EASY, now);
        assertThat(s.getIntervalDays()).isEqualTo(3);
        SrsScheduler.apply(s, Rating.EASY, now);
        assertThat(s.getIntervalDays()).isEqualTo(Math.round(3 * s.getEaseFactor() * 10) / 10.0);
        assertThat(s.getEaseFactor()).isEqualTo(2.65, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void forgotResetsAndRelearnsSoon() {
        SrsState s = new SrsState();
        SrsScheduler.apply(s, Rating.EASY, now);
        SrsScheduler.apply(s, Rating.EASY, now);
        SrsScheduler.apply(s, Rating.FORGOT, now);
        assertThat(s.getRepetitions()).isZero();
        assertThat(s.getLapses()).isEqualTo(1);
        assertThat(s.getIntervalDays()).isZero();
        assertThat(s.getDueAt()).isEqualTo(now.plus(SrsScheduler.RELEARN_DELAY));
        assertThat(s.getEaseFactor()).isLessThan(2.5);
    }

    @Test
    void hardGrowsSlowlyAndEaseHasFloor() {
        SrsState s = new SrsState();
        s.setIntervalDays(10);
        s.setRepetitions(3);
        SrsScheduler.apply(s, Rating.HARD, now);
        assertThat(s.getIntervalDays()).isEqualTo(12);
        for (int i = 0; i < 20; i++) {
            SrsScheduler.apply(s, Rating.HARD, now);
        }
        assertThat(s.getEaseFactor()).isEqualTo(SrsScheduler.MIN_EASE);
    }

    @Test
    void streakCountsConsecutiveGoalDays() {
        LocalDate today = LocalDate.of(2026, 3, 10);
        Map<LocalDate, Long> perDay = new HashMap<>();
        perDay.put(today.minusDays(1), 20L);
        perDay.put(today.minusDays(2), 25L);
        perDay.put(today.minusDays(3), 5L);
        perDay.put(today.minusDays(4), 30L);
        assertThat(ReviewService.streak(perDay, today, 20)).isEqualTo(2);
        perDay.put(today, 20L);
        assertThat(ReviewService.streak(perDay, today, 20)).isEqualTo(3);
        assertThat(ReviewService.streak(Map.of(), today, 20)).isZero();
    }
}
