package app.lector.dashboard;

import app.lector.progress.WordsReadRepository;
import app.lector.session.ReadingSessionRepository;
import app.lector.srs.ReviewService;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import app.lector.vocabmap.KnownBaseWords;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    public record LanguageProgress(Language language, long known, long knownBase, long learning, long ignored, long sessions,
                                   long readingSeconds, long wordsRead, long listenedSeconds) {}

    public record DayValue(LocalDate day, long value) {}

    public record Growth(Language language, List<DayValue> known) {}

    public record Dashboard(
            List<LanguageProgress> languages,
            long totalSessions,
            long totalReadingSeconds,
            long totalWordsRead,
            long totalListenedSeconds,
            long textsImported,
            List<Growth> growth,
            List<DayValue> readingMinutesByDay,
            ReviewService.Stats review,
            ActivityTally.Activity activity,
            ActivityService.PeriodStats period,
            ActivityService.GoalToday goal) {}

    private final VocabularyRepository vocabulary;
    private final ReadingSessionRepository sessions;
    private final TextRepository texts;
    private final ReviewService reviews;
    private final PlanService plans;
    private final CurrentUser currentUser;
    private final ActivityService activity;
    private final WordsReadRepository wordsRead;
    private final KnownBaseWords baseWords;

    public DashboardController(VocabularyRepository vocabulary, ReadingSessionRepository sessions,
                               TextRepository texts, ReviewService reviews, PlanService plans,
                               CurrentUser currentUser, ActivityService activity, WordsReadRepository wordsRead,
                               KnownBaseWords baseWords) {
        this.baseWords = baseWords;
        this.activity = activity;
        this.wordsRead = wordsRead;
        this.vocabulary = vocabulary;
        this.sessions = sessions;
        this.texts = texts;
        this.reviews = reviews;
        this.plans = plans;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Dashboard dashboard(@AuthenticationPrincipal AuthUser principal,
                               @RequestParam(defaultValue = "90") int days,
                               @RequestParam(required = false) StatsPeriod period) {
        User user = currentUser.load(principal);
        ZoneId zone = user.zone();
        int span = Math.min(Math.max(days, 7), 365);
        List<LanguageProgress> languages = languageProgress(user);
        LocalDate today = LocalDate.now(zone);
        LocalDate growthFrom = period == null ? today.minusDays(span - 1L) : activity.periodStart(user, period.growthPeriod(), today);
        ReviewService.Stats review = plans.hasFeature(user, PlanService.Feature.SRS) ? reviews.stats(user, null) : null;
        return new Dashboard(languages,
                languages.stream().mapToLong(LanguageProgress::sessions).sum(),
                languages.stream().mapToLong(LanguageProgress::readingSeconds).sum(),
                languages.stream().mapToLong(LanguageProgress::wordsRead).sum(),
                languages.stream().mapToLong(LanguageProgress::listenedSeconds).sum(),
                texts.countByOwnerId(user.getId()),
                growth(user, languages, growthFrom, today),
                readingMinutes(user, today.minusDays(29), today),
                review,
                activity.activity(user),
                activity.period(user, period == null ? StatsPeriod.WEEK : period),
                activity.goalToday(user));
    }

    public record Header(int current, int best, boolean activeToday, long secondsLeftToday, long knownWords,
                         long knownBaseWords, ActivityService.GoalToday goal) {}

    @GetMapping("/header")
    @Transactional(readOnly = true)
    public Header header(@AuthenticationPrincipal AuthUser principal, @RequestParam(required = false) Language language) {
        User user = currentUser.load(principal);
        ActivityService.StreakNow s = activity.streakNow(user);
        long known = vocabulary.countByLanguageAndStatus(user.getId()).stream()
                .filter(c -> c.getStatus() == WordStatus.KNOWN && (language == null || c.getLanguage() == language))
                .mapToLong(c -> c.getCount()).sum();
        return new Header(s.current(), s.best(), s.activeToday(), s.secondsLeftToday(), known,
                baseWords.count(user.getId(), language), activity.goalToday(user));
    }

    private List<LanguageProgress> languageProgress(User user) {
        Map<Language, long[]> counts = new EnumMap<>(Language.class);
        for (var c : vocabulary.countByLanguageAndStatus(user.getId())) {
            int column = switch (c.getStatus()) {
                case KNOWN -> 0;
                case LEARNING -> 1;
                case IGNORED -> 2;
            };
            counts.computeIfAbsent(c.getLanguage(), l -> new long[7])[column] += c.getCount();
        }
        for (var t : sessions.totalsByLanguage(user.getId())) {
            long[] row = counts.computeIfAbsent(t.getLanguage(), l -> new long[7]);
            row[3] = t.getSessions();
            row[4] = t.getSeconds();
            row[6] = t.getListened();
        }
        for (var w : wordsRead.totalsByLanguage(user.getId())) {
            counts.computeIfAbsent(w.getLanguage(), l -> new long[7])[5] = w.getWords();
        }
        Map<Language, Long> bases = baseWords.byLanguage(user.getId());
        List<LanguageProgress> languages = new ArrayList<>();
        counts.forEach((lang, r) -> languages.add(new LanguageProgress(lang, r[0], bases.getOrDefault(lang, 0L),
                r[1], r[2], r[3], r[4], r[5], r[6])));
        return languages;
    }

    private List<Growth> growth(User user, List<LanguageProgress> languages, LocalDate start, LocalDate end) {
        List<Growth> growth = new ArrayList<>();
        for (LanguageProgress lp : languages) {
            if (lp.known() > 0) {
                growth.add(new Growth(lp.language(),
                        cumulative(vocabulary.findKnownTimestamps(user.getId(), lp.language()), user.zone(), start, end)));
            }
        }
        return growth;
    }

    private List<DayValue> readingMinutes(User user, LocalDate start, LocalDate end) {
        ZoneId zone = user.zone();
        Map<LocalDate, Long> secondsByDay = new TreeMap<>();
        for (var s : sessions.findSince(user.getId(), start.atStartOfDay(zone).toInstant())) {
            secondsByDay.merge(LocalDate.ofInstant(s.getStartedAt(), zone), s.getDurationSeconds(), Long::sum);
        }
        List<DayValue> minutes = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            minutes.add(new DayValue(d, Math.round(secondsByDay.getOrDefault(d, 0L) / 60.0)));
        }
        return minutes;
    }

    static List<DayValue> cumulative(List<Instant> knownAt, ZoneId zone, LocalDate start, LocalDate end) {
        Map<LocalDate, Long> perDay = new TreeMap<>();
        long before = 0;
        for (Instant i : knownAt) {
            LocalDate d = LocalDate.ofInstant(i, zone);
            if (d.isBefore(start)) {
                before++;
            } else {
                perDay.merge(d, 1L, Long::sum);
            }
        }
        List<DayValue> out = new ArrayList<>();
        long running = before;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            running += perDay.getOrDefault(d, 0L);
            out.add(new DayValue(d, running));
        }
        return out;
    }

}
