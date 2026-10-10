package app.lector.srs;

import app.lector.common.ApiException;
import app.lector.text.Text;
import app.lector.token.Language;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.VocabularyEntry;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewService {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Card(
            String type,
            Long id,
            Language language,
            String front,
            String definition,
            String pronunciation,
            String partOfSpeech,
            String context,
            String example,
            String translation,
            String notes,
            Long sourceTextId,
            String sourceTextTitle,
            Instant dueAt,
            int repetitions) {}

    public record DayCount(LocalDate day, long count) {}

    public record Stats(long dueWords, long dueSentences, long reviewedToday, int dailyGoal, boolean goalMet,
                        int streak, List<DayCount> history, long wordsInAnki) {}

    public record ReviewResult(Instant nextDueAt, double intervalDays, boolean graduated, Stats stats) {}

    private final VocabularyRepository vocabulary;
    private final SentenceCardRepository sentences;
    private final ReviewLogRepository logs;
    private final PlanService plans;

    public ReviewService(VocabularyRepository vocabulary, SentenceCardRepository sentences, ReviewLogRepository logs,
                         PlanService plans) {
        this.vocabulary = vocabulary;
        this.sentences = sentences;
        this.logs = logs;
        this.plans = plans;
    }

    @Transactional(readOnly = true)
    public List<Card> queue(User user, Language language, int limit, boolean ahead) {
        plans.require(user, PlanService.Feature.SRS);
        Instant cutoff = ahead ? Instant.now().plus(3650, ChronoUnit.DAYS) : Instant.now();
        var page = PageRequest.of(0, Math.min(Math.max(limit, 1), 200));
        List<Card> cards = new ArrayList<>();
        for (VocabularyEntry v : vocabulary.findDue(user.getId(), language, cutoff, page)) {
            Text t = v.getSourceText();
            cards.add(new Card("word", v.getId(), v.getLanguage(), v.getDisplayTerm(), v.getDefinition(),
                    v.getPronunciation(), v.getPartOfSpeech(), v.getContextSentence(), v.getExample(), null, v.getNote(),
                    t == null ? null : t.getId(), t == null ? null : t.getTitle(), v.getSrs().getDueAt(),
                    v.getSrs().getRepetitions()));
        }
        for (SentenceCard s : sentences.findDue(user.getId(), language, cutoff, page)) {
            Text t = s.getSourceText();
            cards.add(new Card("sentence", s.getId(), s.getLanguage(), s.getSentence(), null, null, null, null, null,
                    s.getTranslation(), s.getNotes(), t == null ? null : t.getId(), t == null ? null : t.getTitle(),
                    s.getSrs().getDueAt(), s.getSrs().getRepetitions()));
        }
        cards.sort(Comparator.comparing(Card::dueAt));
        return cards.size() > limit ? cards.subList(0, limit) : cards;
    }

    @Transactional
    public ReviewResult review(User user, String type, Long id, Rating rating, Language statsLanguage) {
        plans.require(user, PlanService.Feature.SRS);
        Instant now = Instant.now();
        SrsState state;
        ReviewLog.CardType cardType;
        boolean graduated = false;
        if ("word".equals(type)) {
            VocabularyEntry entry = vocabulary.findById(id)
                    .filter(v -> v.getUser().getId().equals(user.getId()))
                    .orElseThrow(() -> ApiException.notFound("Card"));
            if (entry.getStatus() != WordStatus.LEARNING) {
                throw ApiException.badRequest("Only words you are learning can be reviewed");
            }
            state = entry.getSrs();
            SrsScheduler.apply(state, rating, now);
            entry.touch();
            if (state.getIntervalDays() >= SrsScheduler.GRADUATE_DAYS) {
                entry.changeStatus(WordStatus.KNOWN);
                graduated = true;
            }
            cardType = ReviewLog.CardType.WORD;
        } else if ("sentence".equals(type)) {
            SentenceCard card = sentences.findById(id)
                    .filter(s -> s.getUser().getId().equals(user.getId()))
                    .orElseThrow(() -> ApiException.notFound("Card"));
            state = card.getSrs();
            SrsScheduler.apply(state, rating, now);
            cardType = ReviewLog.CardType.SENTENCE;
        } else {
            throw ApiException.badRequest("Unknown card type: " + type);
        }
        logs.save(new ReviewLog(user, cardType, id, rating, LocalDate.now(user.zone())));
        return new ReviewResult(state.getDueAt(), state.getIntervalDays(), graduated, stats(user, statsLanguage));
    }

    @Transactional(readOnly = true)
    public Stats stats(User user, Language language) {
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(user.zone());
        Map<LocalDate, Long> perDay = new HashMap<>();
        for (var dc : logs.countPerDaySince(user.getId(), today.minusDays(365))) {
            perDay.put(dc.getDay(), dc.getCount());
        }
        int goal = user.getDailyReviewGoal();
        long reviewedToday = perDay.getOrDefault(today, 0L);
        List<DayCount> history = new ArrayList<>();
        for (int i = 29; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            history.add(new DayCount(d, perDay.getOrDefault(d, 0L)));
        }
        return new Stats(
                vocabulary.countDue(user.getId(), language, now),
                sentences.countDue(user.getId(), language, now),
                reviewedToday, goal, reviewedToday >= goal, streak(perDay, today, goal), history,
                vocabulary.countLearningInAnki(user.getId(), language));
    }

    static int streak(Map<LocalDate, Long> perDay, LocalDate today, int goal) {
        LocalDate day = perDay.getOrDefault(today, 0L) >= goal ? today : today.minusDays(1);
        int streak = 0;
        while (perDay.getOrDefault(day, 0L) >= goal) {
            streak++;
            day = day.minusDays(1);
        }
        return streak;
    }
}
