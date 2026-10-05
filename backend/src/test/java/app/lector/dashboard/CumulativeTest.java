package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class CumulativeTest {

    @Test
    void countsWordsKnownBeforeTheWindowAsTheStartingTotal() {
        ZoneId utc = ZoneId.of("UTC");
        List<Instant> knownAt = List.of(
                Instant.parse("2026-01-01T10:00:00Z"),   // before the window
                Instant.parse("2026-01-10T23:59:00Z"),   // day 1
                Instant.parse("2026-01-12T00:01:00Z"),   // day 3
                Instant.parse("2026-01-12T05:00:00Z"));  // day 3
        var series = DashboardController.cumulative(knownAt, utc, LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 12));
        assertThat(series).extracting(DashboardController.DayValue::value).containsExactly(2L, 2L, 4L);
        assertThat(series.getFirst().day()).isEqualTo(LocalDate.of(2026, 1, 10));
    }

    @Test
    void usesTheUsersTimeZoneForDayBoundaries() {
        var series = DashboardController.cumulative(List.of(Instant.parse("2026-01-11T03:00:00Z")),
                ZoneId.of("America/Denver"), LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 11));
        assertThat(series).extracting(DashboardController.DayValue::value).containsExactly(1L, 1L);
    }
}
