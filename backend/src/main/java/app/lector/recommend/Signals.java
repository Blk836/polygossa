package app.lector.recommend;

import java.time.Duration;
import java.time.Instant;

public final class Signals {

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

    public static boolean abandoned(int percent, boolean completed, Instant progressAt, Instant now) {
        return !completed && percent < 10 && progressAt != null && !progressAt.plus(ABANDON_AFTER).isAfter(now);
    }

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
