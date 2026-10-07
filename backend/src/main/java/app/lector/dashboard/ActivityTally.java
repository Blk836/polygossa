package app.lector.dashboard;

import app.lector.user.DailyGoal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Practice per calendar day (in the user's time zone) and the daily streak built from it. A day counts as practice if
 * the learner read or listened for at least a minute, read any words, saved a word, marked one known, reviewed a card
 * or handed in a writing test; with the opt-in goal-only streak, only days that reach the daily goal count.
 */
final class ActivityTally {

    static final long MIN_READING_SECONDS = 60;
    static final long MIN_LISTENING_SECONDS = 60;

    /** One day's practice. */
    public record Day(LocalDate day, long readingSeconds, long wordsSaved, long wordsKnown, long reviews,
                      long writingTests, long wordsRead, long listenedSeconds, boolean active, boolean goalMet) {}

    /**
     * Consecutive practice days ending today, or yesterday while today has no practice yet (the streak is still
     * alive until the day ends); {@code best} is the longest run in the tallied history.
     */
    public record Streak(int current, int best, boolean activeToday) {}

    /** Totals over a span of days. */
    public record Period(long readingSeconds, long wordsSaved, long wordsKnown, long reviews, long wordsRead,
                         long listenedSeconds, int activeDays) {}

    /** The streak, the last {@code shown} days oldest first, and this week (last 7 days) against the 7 before. */
    public record Activity(Streak streak, List<Day> days, Period thisWeek, Period lastWeek) {}

    private static final int READING = 0;
    private static final int SAVED = 1;
    private static final int KNOWN = 2;
    private static final int REVIEWS = 3;
    private static final int WRITING = 4;
    private static final int WORDS_READ = 5;
    private static final int LISTENED = 6;
    private static final int COLUMNS = 7;

    private final ZoneId zone;
    /** Null when no goal is tallied (days then never report a goal met). */
    private final DailyGoal goal;
    private final boolean streakNeedsGoal;
    private final Map<LocalDate, long[]> byDay = new HashMap<>();

    ActivityTally(ZoneId zone) {
        this(zone, null, false);
    }

    ActivityTally(ZoneId zone, DailyGoal goal, boolean streakNeedsGoal) {
        this.zone = zone;
        this.goal = goal;
        this.streakNeedsGoal = streakNeedsGoal && goal != null;
    }

    void reading(Instant at, long seconds) {
        add(LocalDate.ofInstant(at, zone), READING, seconds);
    }

    void listening(Instant at, long seconds) {
        add(LocalDate.ofInstant(at, zone), LISTENED, seconds);
    }

    /** Words read are stored per calendar day already. */
    void wordsRead(LocalDate day, long words) {
        add(day, WORDS_READ, words);
    }

    void wordSaved(Instant at) {
        add(LocalDate.ofInstant(at, zone), SAVED, 1);
    }

    void wordKnown(Instant at) {
        add(LocalDate.ofInstant(at, zone), KNOWN, 1);
    }

    /** Review logs already carry the user's calendar day. */
    void reviews(LocalDate day, long count) {
        add(day, REVIEWS, count);
    }

    void writing(Instant at) {
        add(LocalDate.ofInstant(at, zone), WRITING, 1);
    }

    private void add(LocalDate day, int column, long amount) {
        byDay.computeIfAbsent(day, d -> new long[COLUMNS])[column] += amount;
    }

    Activity summarise(LocalDate today, int shown) {
        List<Day> days = new ArrayList<>();
        for (LocalDate d = today.minusDays(Math.max(shown, 1) - 1L); !d.isAfter(today); d = d.plusDays(1)) {
            days.add(day(d));
        }
        return new Activity(streak(today), days, total(today.minusDays(6), today),
                total(today.minusDays(13), today.minusDays(7)));
    }

    /** What the goal measures on {@code day}. */
    DailyGoal.Day goalDay(LocalDate day) {
        long[] c = byDay.getOrDefault(day, new long[COLUMNS]);
        return new DailyGoal.Day(c[REVIEWS], c[WORDS_READ], c[READING], c[LISTENED]);
    }

    private Day day(LocalDate d) {
        long[] c = byDay.getOrDefault(d, new long[COLUMNS]);
        return new Day(d, c[READING], c[SAVED], c[KNOWN], c[REVIEWS], c[WRITING], c[WORDS_READ], c[LISTENED],
                isActive(d, c), goalMet(d));
    }

    private boolean goalMet(LocalDate d) {
        return goal != null && goal.met(goalDay(d));
    }

    private boolean isActive(LocalDate d, long[] c) {
        if (streakNeedsGoal) {
            return goalMet(d);
        }
        return c[READING] >= MIN_READING_SECONDS || c[LISTENED] >= MIN_LISTENING_SECONDS
                || c[SAVED] + c[KNOWN] + c[REVIEWS] + c[WRITING] + c[WORDS_READ] > 0;
    }

    private boolean active(LocalDate d) {
        long[] c = byDay.get(d);
        return c != null && isActive(d, c);
    }

    private Streak streak(LocalDate today) {
        boolean activeToday = active(today);
        int current = 0;
        for (LocalDate d = activeToday ? today : today.minusDays(1); active(d); d = d.minusDays(1)) {
            current++;
        }
        int best = 0;
        int run = 0;
        LocalDate previous = null;
        for (LocalDate d : new TreeSet<>(byDay.keySet())) {
            if (!active(d)) {
                continue;
            }
            run = previous != null && previous.plusDays(1).equals(d) ? run + 1 : 1;
            best = Math.max(best, run);
            previous = d;
        }
        return new Streak(current, best, activeToday);
    }

    /** Totals from {@code from} to {@code to}, both included. */
    Period total(LocalDate from, LocalDate to) {
        long[] sum = new long[COLUMNS];
        int activeDays = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long[] c = byDay.getOrDefault(d, new long[COLUMNS]);
            for (int i = 0; i < sum.length; i++) {
                sum[i] += c[i];
            }
            activeDays += isActive(d, c) ? 1 : 0;
        }
        return new Period(sum[READING], sum[SAVED], sum[KNOWN], sum[REVIEWS], sum[WORDS_READ], sum[LISTENED],
                activeDays);
    }
}
