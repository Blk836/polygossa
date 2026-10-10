package app.lector.srs;

import java.time.Duration;
import java.time.Instant;

public final class SrsScheduler {

    public static final double MIN_EASE = 1.3;
    public static final double MAX_EASE = 3.0;
    public static final Duration RELEARN_DELAY = Duration.ofMinutes(10);
    public static final double GRADUATE_DAYS = 90;

    private SrsScheduler() {}

    public static void apply(SrsState s, Rating rating, Instant now) {
        double prev = s.getIntervalDays();
        switch (rating) {
            case FORGOT -> {
                s.setLapses(s.getLapses() + 1);
                s.setRepetitions(0);
                s.setEaseFactor(Math.max(MIN_EASE, s.getEaseFactor() - 0.2));
                s.setIntervalDays(0);
                s.setDueAt(now.plus(RELEARN_DELAY));
            }
            case HARD -> {
                s.setRepetitions(s.getRepetitions() + 1);
                s.setEaseFactor(Math.max(MIN_EASE, s.getEaseFactor() - 0.15));
                double next = prev < 1 ? 1 : Math.max(prev + 1, prev * 1.2);
                schedule(s, next, now);
            }
            case EASY -> {
                s.setRepetitions(s.getRepetitions() + 1);
                s.setEaseFactor(Math.min(MAX_EASE, s.getEaseFactor() + 0.05));
                double next = switch (s.getRepetitions()) {
                    case 1 -> 1;
                    case 2 -> 3;
                    default -> Math.max(prev + 1, prev * s.getEaseFactor());
                };
                schedule(s, next, now);
            }
        }
        s.setLastReviewedAt(now);
    }

    private static void schedule(SrsState s, double days, Instant now) {
        double rounded = Math.round(days * 10) / 10.0;
        s.setIntervalDays(rounded);
        s.setDueAt(now.plus(Duration.ofMinutes(Math.round(rounded * 24 * 60))));
    }
}
