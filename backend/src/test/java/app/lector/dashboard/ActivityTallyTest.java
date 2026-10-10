package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.dashboard.ActivityTally.Activity;
import app.lector.dashboard.ActivityTally.Day;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ActivityTallyTest {

    static final ZoneId UTC = ZoneId.of("UTC");
    static final LocalDate TODAY = LocalDate.of(2026, 3, 20);

    static Instant at(LocalDate day) {
        return day.atTime(12, 0).toInstant(java.time.ZoneOffset.UTC);
    }

    static ActivityTally activeOn(int... daysAgo) {
        ActivityTally t = new ActivityTally(UTC);
        for (int d : daysAgo) {
            t.wordSaved(at(TODAY.minusDays(d)));
        }
        return t;
    }

    @Test
    void noActivityMeansNoStreak() {
        Activity a = new ActivityTally(UTC).summarise(TODAY, 7);
        assertThat(a.streak().current()).isZero();
        assertThat(a.streak().best()).isZero();
        assertThat(a.streak().activeToday()).isFalse();
        assertThat(a.days()).hasSize(7).noneMatch(Day::active);
        assertThat(a.days().getFirst().day()).isEqualTo(TODAY.minusDays(6));
        assertThat(a.days().getLast().day()).isEqualTo(TODAY);
    }

    @Test
    void consecutiveDaysEndingTodayCount() {
        Activity a = activeOn(0, 1, 2).summarise(TODAY, 7);
        assertThat(a.streak().current()).isEqualTo(3);
        assertThat(a.streak().activeToday()).isTrue();
    }

    @Test
    void aStreakThroughYesterdayIsStillAliveBeforeTodaysPractice() {
        Activity a = activeOn(1, 2).summarise(TODAY, 7);
        assertThat(a.streak().current()).isEqualTo(2);
        assertThat(a.streak().activeToday()).isFalse();
    }

    @Test
    void aMissedDayResetsTheStreak() {
        assertThat(activeOn(0, 2, 3).summarise(TODAY, 7).streak().current()).as("yesterday missed").isEqualTo(1);
        assertThat(activeOn(2, 3).summarise(TODAY, 7).streak().current()).as("today and yesterday missed").isZero();
    }

    @Test
    void bestIsTheLongestRunEvenOutsideTheShownDays() {
        Activity a = activeOn(0, 30, 31, 32, 33).summarise(TODAY, 7);
        assertThat(a.streak().current()).isEqualTo(1);
        assertThat(a.streak().best()).isEqualTo(4);
        assertThat(activeOn(0, 1).summarise(TODAY, 7).streak().best()).as("best includes the current run").isEqualTo(2);
    }

    @Test
    void anyKindOfPracticeMakesADayActive() {
        ActivityTally t = new ActivityTally(UTC);
        t.reading(at(TODAY.minusDays(1)), 60);
        t.wordKnown(at(TODAY.minusDays(2)));
        t.reviews(TODAY.minusDays(3), 1);
        t.writing(at(TODAY.minusDays(4)));
        t.wordSaved(at(TODAY.minusDays(5)));
        assertThat(t.summarise(TODAY, 7).streak().current()).isEqualTo(5);
    }

    @Test
    void lessThanAMinuteOfReadingIsNotPractice() {
        ActivityTally t = new ActivityTally(UTC);
        t.reading(at(TODAY), 30);
        t.reading(at(TODAY), 29);
        assertThat(t.summarise(TODAY, 1).days().getFirst().active()).isFalse();
        t.reading(at(TODAY), 1);
        Day today = t.summarise(TODAY, 1).days().getFirst();
        assertThat(today.active()).as("a minute in total across sessions").isTrue();
        assertThat(today.readingSeconds()).isEqualTo(60);
    }

    @Test
    void daysFollowTheUsersTimeZone() {
        ActivityTally t = new ActivityTally(ZoneId.of("America/Denver"));
        t.wordSaved(Instant.parse("2026-03-21T03:00:00Z"));
        Activity a = t.summarise(TODAY, 2);
        assertThat(a.streak().activeToday()).isTrue();
        assertThat(a.days().getLast().wordsSaved()).isEqualTo(1);
    }

    @Test
    void eachDayCountsWhatWasDone() {
        ActivityTally t = new ActivityTally(UTC);
        t.reading(at(TODAY), 90);
        t.reading(at(TODAY), 30);
        t.wordSaved(at(TODAY));
        t.wordSaved(at(TODAY));
        t.wordKnown(at(TODAY));
        t.reviews(TODAY, 5);
        t.writing(at(TODAY));
        Day d = t.summarise(TODAY, 1).days().getFirst();
        assertThat(d.readingSeconds()).isEqualTo(120);
        assertThat(d.wordsSaved()).isEqualTo(2);
        assertThat(d.wordsKnown()).isEqualTo(1);
        assertThat(d.reviews()).isEqualTo(5);
        assertThat(d.writingTests()).isEqualTo(1);
    }

    @Test
    void thisWeekIsTheLastSevenDaysAndLastWeekTheSevenBefore() {
        ActivityTally t = new ActivityTally(UTC);
        t.wordKnown(at(TODAY));
        t.wordKnown(at(TODAY.minusDays(6)));
        t.reading(at(TODAY.minusDays(6)), 600);
        t.wordKnown(at(TODAY.minusDays(7)));
        t.reading(at(TODAY.minusDays(13)), 120);
        t.wordKnown(at(TODAY.minusDays(14)));
        t.reviews(TODAY.minusDays(8), 3);
        t.wordSaved(at(TODAY.minusDays(1)));
        Activity a = t.summarise(TODAY, 7);
        assertThat(a.thisWeek()).isEqualTo(new ActivityTally.Period(600, 1, 2, 0, 0, 0, 3));
        assertThat(a.lastWeek()).isEqualTo(new ActivityTally.Period(120, 0, 1, 3, 0, 0, 3));
    }

    @Test
    void anyPeriodSumsItsDaysInclusive() {
        ActivityTally t = new ActivityTally(UTC);
        t.wordKnown(at(TODAY));
        t.wordKnown(at(TODAY.minusDays(29)));
        t.reading(at(TODAY.minusDays(29)), 300);
        t.wordKnown(at(TODAY.minusDays(30)));
        t.reviews(TODAY.minusDays(59), 2);
        t.wordSaved(at(TODAY.minusDays(60)));
        assertThat(t.total(TODAY.minusDays(29), TODAY)).isEqualTo(new ActivityTally.Period(300, 0, 2, 0, 0, 0, 2));
        assertThat(t.total(TODAY.minusDays(59), TODAY.minusDays(30))).isEqualTo(new ActivityTally.Period(0, 0, 1, 2, 0, 0, 2));
    }

    @Test
    void aPeriodOfOneDayIsJustThatDay() {
        assertThat(activeOn(0, 1).total(TODAY, TODAY).activeDays()).isEqualTo(1);
    }

    @Test
    void shownDaysAreClampedToAtLeastOne() {
        assertThat(activeOn(0).summarise(TODAY, 0).days()).hasSize(1);
    }
}
