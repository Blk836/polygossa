package app.lector.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** reading-listening-goals.feature: what a daily goal measures, its limits, and when a day reaches it. */
class DailyGoalTest {

    @ParameterizedTest
    @CsvSource({"REVIEWS, 1, 500", "WORDS_READ, 50, 50000", "MINUTES_READ, 1, 600", "MINUTES_LISTENED, 1, 600"})
    void targetsHaveLimits(GoalKind kind, int min, int max) {
        assertThat(new DailyGoal(kind, min).target()).isEqualTo(min);
        assertThat(new DailyGoal(kind, max).target()).isEqualTo(max);
        assertThatThrownBy(() -> new DailyGoal(kind, min - 1)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> new DailyGoal(kind, max + 1)).isInstanceOf(ApiException.class);
    }

    @Test
    void measuresTheDaysFigure() {
        DailyGoal.Day day = new DailyGoal.Day(12, 340, 125, 61);
        assertThat(new DailyGoal(GoalKind.REVIEWS, 12).done(day)).isEqualTo(12);
        assertThat(new DailyGoal(GoalKind.WORDS_READ, 1000).done(day)).isEqualTo(340);
        assertThat(new DailyGoal(GoalKind.MINUTES_READ, 5).done(day)).isEqualTo(2);
        assertThat(new DailyGoal(GoalKind.MINUTES_LISTENED, 5).done(day)).isEqualTo(1);
    }

    @Test
    void isMetAtTheTarget() {
        assertThat(new DailyGoal(GoalKind.REVIEWS, 12).met(new DailyGoal.Day(12, 0, 0, 0))).isTrue();
        assertThat(new DailyGoal(GoalKind.REVIEWS, 12).met(new DailyGoal.Day(11, 0, 0, 0))).isFalse();
        assertThat(new DailyGoal(GoalKind.MINUTES_READ, 2).met(new DailyGoal.Day(0, 0, 119, 0))).isFalse();
        assertThat(new DailyGoal(GoalKind.MINUTES_READ, 2).met(new DailyGoal.Day(0, 0, 120, 0))).isTrue();
    }

    @Test
    void kindsAreLowerCaseInJson() {
        assertThat(GoalKind.WORDS_READ.json()).isEqualTo("words_read");
        assertThat(GoalKind.parse("minutes_listened")).isEqualTo(GoalKind.MINUTES_LISTENED);
        assertThatThrownBy(() -> GoalKind.parse("pages")).isInstanceOf(IllegalArgumentException.class);
    }
}
