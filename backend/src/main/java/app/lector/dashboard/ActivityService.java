package app.lector.dashboard;

import app.lector.progress.WordsReadRepository;
import app.lector.session.ReadingSessionRepository;
import app.lector.srs.ReviewLogRepository;
import app.lector.user.DailyGoal;
import app.lector.user.GoalKind;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.VocabularyRepository;
import app.lector.writing.WritingTestRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityService {

    static final int SHOWN_DAYS = 84;
    static final int HISTORY_DAYS = 365;

    private final ReadingSessionRepository sessions;
    private final VocabularyRepository vocabulary;
    private final ReviewLogRepository reviews;
    private final WritingTestRepository writing;
    private final WordsReadRepository wordsRead;
    private final PlanService plans;
    private final Clock clock;

    public ActivityService(ReadingSessionRepository sessions, VocabularyRepository vocabulary,
                           ReviewLogRepository reviews, WritingTestRepository writing, WordsReadRepository wordsRead,
                           PlanService plans, Clock clock) {
        this.sessions = sessions;
        this.plans = plans;
        this.wordsRead = wordsRead;
        this.vocabulary = vocabulary;
        this.reviews = reviews;
        this.writing = writing;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ActivityTally.Activity activity(User user) {
        ZoneId zone = user.zone();
        LocalDate today = LocalDate.ofInstant(clock.instant(), zone);
        return tally(user, today.minusDays(HISTORY_DAYS - 1L)).summarise(today, SHOWN_DAYS);
    }

    private ActivityTally tally(User user, LocalDate first) {
        ZoneId zone = user.zone();
        Instant since = first.atStartOfDay(zone).toInstant();
        Long id = user.getId();
        ActivityTally tally = new ActivityTally(zone, plans.dailyGoal(user), user.isStreakNeedsGoal());
        sessions.findSince(id, since).forEach(s -> {
            tally.reading(s.getStartedAt(), s.getDurationSeconds());
            tally.listening(s.getStartedAt(), s.getListenedSeconds());
        });
        wordsRead.perDaySince(id, first).forEach(w -> tally.wordsRead(w.getDay(), w.getWords()));
        vocabulary.findCreatedSince(id, since).forEach(tally::wordSaved);
        vocabulary.findKnownSince(id, since).forEach(tally::wordKnown);
        reviews.countPerDaySince(id, first).forEach(r -> tally.reviews(r.getDay(), r.getCount()));
        writing.findSubmittedSince(id, since).forEach(tally::writing);
        return tally;
    }

    public record PeriodStats(StatsPeriod period, int days, ActivityTally.Period current, ActivityTally.Period previous) {}

    @Transactional(readOnly = true)
    public PeriodStats period(User user, StatsPeriod period) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), user.zone());
        LocalDate start = periodStart(user, period, today);
        int days = (int) ChronoUnit.DAYS.between(start, today) + 1;
        if (period == StatsPeriod.ALL) {
            return new PeriodStats(period, days, tally(user, start).total(start, today), null);
        }
        LocalDate before = start.minusDays(days);
        ActivityTally tally = tally(user, before);
        return new PeriodStats(period, days, tally.total(start, today), tally.total(before, start.minusDays(1)));
    }

    public LocalDate periodStart(User user, StatsPeriod period, LocalDate today) {
        if (period != StatsPeriod.ALL) {
            return today.minusDays(period.days() - 1L);
        }
        LocalDate joined = LocalDate.ofInstant(user.getCreatedAt(), user.zone());
        return joined.isAfter(today) ? today : joined;
    }

    public record GoalToday(GoalKind kind, int target, long done, boolean met) {}

    @Transactional(readOnly = true)
    public GoalToday goalToday(User user) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), user.zone());
        DailyGoal goal = plans.dailyGoal(user);
        DailyGoal.Day day = tally(user, today).goalDay(today);
        return new GoalToday(goal.kind(), goal.target(), goal.done(day), goal.met(day));
    }

    public record StreakNow(int current, int best, boolean activeToday, long secondsLeftToday) {}

    @Transactional(readOnly = true)
    public StreakNow streakNow(User user) {
        ActivityTally.Streak streak = activity(user).streak();
        Instant now = clock.instant();
        ZoneId zone = user.zone();
        Instant midnight = LocalDate.ofInstant(now, zone).plusDays(1).atStartOfDay(zone).toInstant();
        return new StreakNow(streak.current(), streak.best(), streak.activeToday(),
                Duration.between(now, midnight).toSeconds());
    }
}
