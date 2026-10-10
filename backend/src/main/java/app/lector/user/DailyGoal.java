package app.lector.user;

import app.lector.common.ApiException;

public record DailyGoal(GoalKind kind, int target) {

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
