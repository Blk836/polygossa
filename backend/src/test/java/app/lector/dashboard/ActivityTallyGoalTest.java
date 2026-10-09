package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.dashboard.ActivityTally.Activity;
import app.lector.dashboard.ActivityTally.Day;
import app.lector.user.DailyGoal;
import app.lector.user.GoalKind;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ActivityTallyGoalTest {

    static final ZoneId UTC = ZoneId.of("UTC");
    static final LocalDate TODAY = LocalDate.of(2026, 3, 20);

    @Test
    void daysAndPeriodsCarryWordsReadAndListening() {
        ActivityTally t = new ActivityTally(UTC);
        t.wordsRead(TODAY, 120);
        t.wordsRead(TODAY, 30);
        t.listening(ActivityTallyTest.at(TODAY), 45);
        t.listening(ActivityTallyTest.at(TODAY.minusDays(8)), 10);
        Activity a = t.summarise(TODAY, 7);
        Day today = a.days().getLast();
        assertThat(today.wordsRead()).isEqualTo(150);
        assertThat(today.listenedSeconds()).isEqualTo(45);
        assertThat(a.thisWeek().wordsRead()).isEqualTo(150);
        assertThat(a.thisWeek().listenedSeconds()).isEqualTo(45);
        assertThat(a.lastWeek().listenedSeconds()).isEqualTo(10);
    }

    @Test
    void wordsReadOrAMinuteOfListeningIsPractice() {
        ActivityTally t = new ActivityTally(UTC);
        t.wordsRead(TODAY, 1);
        t.listening(ActivityTallyTest.at(TODAY.minusDays(1)), 60);
        t.listening(ActivityTallyTest.at(TODAY.minusDays(2)), 59);
        Activity a = t.summarise(TODAY, 3);
        assertThat(a.days()).extracting(Day::active).containsExactly(false, true, true);
    }

    @Test
    void theGoalOnlyStreakCountsDaysThatReachTheGoal() {
        ActivityTally t = new ActivityTally(UTC, new DailyGoal(GoalKind.WORDS_READ, 100), true);
        t.wordsRead(TODAY, 100);
        t.wordsRead(TODAY.minusDays(1), 99);
        t.wordSaved(ActivityTallyTest.at(TODAY.minusDays(1)));
        t.wordsRead(TODAY.minusDays(2), 500);
        Activity a = t.summarise(TODAY, 3);
        assertThat(a.days()).extracting(Day::active).containsExactly(true, false, true);
        assertThat(a.days()).extracting(Day::goalMet).containsExactly(true, false, true);
        assertThat(a.streak().current()).isEqualTo(1);
    }

    @Test
    void withoutTheSettingAnyPracticeCountsButGoalMetIsStillReported() {
        ActivityTally t = new ActivityTally(UTC, new DailyGoal(GoalKind.REVIEWS, 10), false);
        t.reviews(TODAY, 3);
        Day today = t.summarise(TODAY, 1).days().getLast();
        assertThat(today.active()).isTrue();
        assertThat(today.goalMet()).isFalse();
    }
}
