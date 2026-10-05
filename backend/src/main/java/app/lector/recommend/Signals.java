package app.lector.recommend;

import java.time.Duration;
import java.time.Instant;

/**
 * Implicit feedback: how much one learner's activity on one text says they liked it, each signal decaying from when it
 * happened. Finished +3, read at least half +2, liked +3, bookmarked +2, +1 per 10 minutes read (at most +3), opened
 * and left under 10% for a week -1, "Not interested" -4.
 */
public final class Signals {

    /**
     * What a learner did with a text. Dates may be null when the signal is absent ({@code readAt} null with time
     * spent counts the time undecayed).
     */
    public record Activity(boolean completed, int percent, Instant progressAt, Instant likedAt, Instant bookmarkedAt,
                           long seconds, Instant readAt, Instant dismissedAt) {}

    static final double COMPLETED = 3;
    static final double READ_HALF = 2;
    static final double LIKED = 3;
    static final double BOOKMARKED = 2;
    static final double PER_TEN_MINUTES = 1;
    static final double MAX_TIME = 3;
    static final double ABANDONED = -1;
    static final double NOT_INTERESTED = -4;
    static final Duration ABANDON_AFTER = Duration.ofDays(7);

    private Signals() {}

    public static double weight(Activity a, Instant now, double halfLifeDays) {
        double w = progress(a, now, halfLifeDays);
        w += at(LIKED, a.likedAt(), now, halfLifeDays) + at(BOOKMARKED, a.bookmarkedAt(), now, halfLifeDays);
        w += at(NOT_INTERESTED, a.dismissedAt(), now, halfLifeDays);
        double time = Math.min(MAX_TIME, PER_TEN_MINUTES * (a.seconds() / 600));
        if (time > 0) {
            w += a.readAt() == null ? time : time * Scoring.decay(Duration.between(a.readAt(), now), halfLifeDays);
        }
        return w;
    }

    private static double progress(Activity a, Instant now, double halfLifeDays) {
        if (a.progressAt() == null) {
            return 0;
        }
        if (abandoned(a.percent(), a.completed(), a.progressAt(), now)) {
            return at(ABANDONED, a.progressAt().plus(ABANDON_AFTER), now, halfLifeDays);
        }
        double w = (a.completed() ? COMPLETED : 0) + (a.percent() >= 50 ? READ_HALF : 0);
        return at(w, a.progressAt(), now, halfLifeDays);
    }

    /** Opened, read under 10%, and not touched for a week. */
    public static boolean abandoned(int percent, boolean completed, Instant progressAt, Instant now) {
        return !completed && percent < 10 && progressAt != null && !progressAt.plus(ABANDON_AFTER).isAfter(now);
    }

    /** Shown in Explore 5 times and never opened: -0.5; 10 times: -1. Not decayed. */
    public static double impressionPenalty(int impressions, int opens) {
        if (opens > 0 || impressions < 5) {
            return 0;
        }
        return impressions >= 10 ? -1 : -0.5;
    }

    private static double at(double weight, Instant when, Instant now, double halfLifeDays) {
        return when == null ? 0 : weight * Scoring.decay(Duration.between(when, now), halfLifeDays);
    }
}
