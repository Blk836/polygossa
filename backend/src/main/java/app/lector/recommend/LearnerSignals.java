package app.lector.recommend;

import app.lector.library.TextReaction;
import app.lector.library.TextReactionRepository;
import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.recommend.RecommendationEventRepository.TextTally;
import app.lector.session.ReadingSessionRepository;
import app.lector.text.Category;
import app.lector.user.User;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Everything one learner did that recommendations learn from, gathered in a handful of queries. */
@Service
public class LearnerSignals {

    /**
     * Per text: what the learner did ({@code activity}), their reading progress, impressions and opens; plus the
     * texts they marked "Not interested" and the categories they picked as interests.
     */
    public record Snapshot(Map<Long, Signals.Activity> activity, Map<Long, ReadingProgress> progress,
                           Set<Long> dismissed, Map<Long, TextTally> tallies, Set<Category> interests) {}

    private final ReadingProgressRepository progress;
    private final TextReactionRepository reactions;
    private final ReadingSessionRepository sessions;
    private final TextDismissalRepository dismissals;
    private final RecommendationEventRepository events;
    private final UserInterestRepository interests;

    public LearnerSignals(ReadingProgressRepository progress, TextReactionRepository reactions,
                          ReadingSessionRepository sessions, TextDismissalRepository dismissals,
                          RecommendationEventRepository events, UserInterestRepository interests) {
        this.progress = progress;
        this.reactions = reactions;
        this.sessions = sessions;
        this.dismissals = dismissals;
        this.events = events;
        this.interests = interests;
    }

    public Snapshot load(User user) {
        Long uid = user.getId();
        Map<Long, Signals.Activity> activity = new HashMap<>();
        Map<Long, ReadingProgress> byText = new HashMap<>();
        for (ReadingProgress p : progress.findAllForUser(uid)) {
            byText.put(p.getTextId(), p);
            update(activity, p.getTextId(), a -> new Signals.Activity(p.isCompleted(), p.getPercent(), p.getUpdatedAt(),
                    a.likedAt(), a.bookmarkedAt(), a.seconds(), a.readAt(), a.dismissedAt()));
        }
        for (TextReaction r : reactions.findAllMine(uid)) {
            boolean like = r.getType() == TextReaction.Type.LIKE;
            update(activity, r.getText().getId(), a -> new Signals.Activity(a.completed(), a.percent(), a.progressAt(),
                    like ? r.getCreatedAt() : a.likedAt(), like ? a.bookmarkedAt() : r.getCreatedAt(), a.seconds(),
                    a.readAt(), a.dismissedAt()));
        }
        for (ReadingSessionRepository.TextTime t : sessions.timeByText(uid)) {
            update(activity, t.getTextId(), a -> new Signals.Activity(a.completed(), a.percent(), a.progressAt(),
                    a.likedAt(), a.bookmarkedAt(), t.getSeconds(), t.getLastActive(), a.dismissedAt()));
        }
        Map<Long, Instant> dismissed = new HashMap<>();
        for (TextDismissal d : dismissals.findByUserId(uid)) {
            dismissed.put(d.getTextId(), d.getCreatedAt());
            update(activity, d.getTextId(), a -> new Signals.Activity(a.completed(), a.percent(), a.progressAt(),
                    a.likedAt(), a.bookmarkedAt(), a.seconds(), a.readAt(), d.getCreatedAt()));
        }
        Map<Long, TextTally> tallies = events.tallies(uid).stream()
                .collect(Collectors.toMap(TextTally::getTextId, t -> t));
        Set<Category> picked = EnumSet.noneOf(Category.class);
        interests.findByUserId(uid).forEach(i -> picked.add(i.getCategory()));
        return new Snapshot(activity, byText, dismissed.keySet(), tallies, picked);
    }

    private static void update(Map<Long, Signals.Activity> activity, Long textId,
                               UnaryOperator<Signals.Activity> change) {
        activity.put(textId, change.apply(activity.getOrDefault(textId,
                new Signals.Activity(false, 0, null, null, null, 0, null, null))));
    }
}
