package app.lector.admin;

import app.lector.user.UserDayRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminStats {

    public record DayValue(LocalDate day, long value) {}

    public record Users(long total, Map<String, Long> perPlan, long suspended, long newToday) {}

    public record LanguageUsers(String language, long users) {}

    public record Content(long texts, long publicTexts, long videos, long playlists, long forumThreads,
                          long forumPosts, long savedWords, long reviewsToday, long wordsReadToday,
                          long aiCallsToday) {}

    public record Stats(Users users, List<DayValue> signups, List<DayValue> active, long activeToday, long active7,
                        long active30, List<LanguageUsers> languages, Content content) {}

    private final EntityManager em;
    private final UserDayRepository userDays;
    private final Clock clock;

    public AdminStats(EntityManager em, UserDayRepository userDays, Clock clock) {
        this.em = em;
        this.userDays = userDays;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Stats stats(int days) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate first = today.minusDays(days - 1L);
        List<DayValue> signups = signups(first, today);
        Map<LocalDate, Long> activeByDay = new TreeMap<>();
        userDays.perDaySince(first).forEach(d -> activeByDay.put(d.getDay(), d.getUsers()));
        List<DayValue> active = series(first, today, activeByDay);
        Users users = new Users(count("select count(u) from User u"), perPlan(),
                count("select count(u) from User u where u.suspended = true"), signups.getLast().value());
        return new Stats(users, signups, active, active.getLast().value(), userDays.distinctSince(today.minusDays(6)),
                userDays.distinctSince(today.minusDays(29)), languages(), content(today));
    }

    private long count(String jpql) {
        return em.createQuery(jpql, Long.class).getSingleResult();
    }

    private long sumToday(String jpql, LocalDate today) {
        Number n = em.createQuery(jpql, Number.class).setParameter("today", today).getSingleResult();
        return n == null ? 0 : n.longValue();
    }

    private Map<String, Long> perPlan() {
        Map<String, Long> plans = new TreeMap<>(Map.of("free", 0L, "pro", 0L, "classroom", 0L));
        for (Object[] row : em.createQuery("select u.tier, count(u) from User u group by u.tier", Object[].class)
                .getResultList()) {
            plans.put(row[0].toString().toLowerCase(Locale.ROOT), (Long) row[1]);
        }
        return plans;
    }

    private List<DayValue> signups(LocalDate first, LocalDate today) {
        Instant since = first.atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<LocalDate, Long> byDay = new TreeMap<>();
        for (Instant at : em.createQuery("select u.createdAt from User u where u.createdAt >= :since", Instant.class)
                .setParameter("since", since).getResultList()) {
            byDay.merge(LocalDate.ofInstant(at, ZoneOffset.UTC), 1L, Long::sum);
        }
        return series(first, today, byDay);
    }

    private static List<DayValue> series(LocalDate first, LocalDate last, Map<LocalDate, Long> byDay) {
        List<DayValue> out = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            out.add(new DayValue(d, byDay.getOrDefault(d, 0L)));
        }
        return out;
    }

    private List<LanguageUsers> languages() {
        List<LanguageUsers> out = new ArrayList<>();
        for (Object[] row : em.createQuery("select u.targetLanguage, count(u) from User u "
                + "where u.targetLanguage is not null group by u.targetLanguage order by count(u) desc", Object[].class)
                .getResultList()) {
            out.add(new LanguageUsers(((app.lector.token.Language) row[0]).code(), (Long) row[1]));
        }
        return out;
    }

    private Content content(LocalDate today) {
        return new Content(
                count("select count(t) from Text t"),
                count("select count(t) from Text t where t.isPublic = true"),
                count("select count(t) from Text t where t.videoId is not null"),
                count("select count(p) from Playlist p"),
                count("select count(t) from ForumThread t"),
                count("select count(p) from ForumPost p"),
                count("select count(v) from VocabularyEntry v"),
                sumToday("select count(r) from ReviewLog r where r.reviewDate = :today", today),
                sumToday("select sum(w.words) from WordsRead w where w.day = :today", today),
                sumToday("select sum(a.calls) from AiUsage a where a.day = :today", today));
    }
}
