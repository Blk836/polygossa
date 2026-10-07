package app.lector.user;

import app.lector.common.ApiException;

/** A learner's daily goal: what it measures and how much of it makes a day. */
public record DailyGoal(GoalKind kind, int target) {

    /** One day's practice, as far as goals are concerned. */
    public record Day(long reviews, long wordsRead, long readingSeconds, long listenedSeconds) {}

    public DailyGoal {
        if (kind == null) {
            throw ApiException.badRequest("The daily goal needs a kind");
        }
        if (target < kind.min() || target > kind.max()) {
            throw ApiException.badRequest("A " + kind.json().replace('_', ' ') + " goal must be " + kind.min() + " to "
                    + kind.max());
        }
    }

    /** How much of the goal's measure the day holds (whole minutes for time goals). */
    public long done(Day day) {
        return switch (kind) {
            case REVIEWS -> day.reviews();
            case WORDS_READ -> day.wordsRead();
            case MINUTES_READ -> day.readingSeconds() / 60;
            case MINUTES_LISTENED -> day.listenedSeconds() / 60;
        };
    }

    public boolean met(Day day) {
        return done(day) >= target;
    }
}
