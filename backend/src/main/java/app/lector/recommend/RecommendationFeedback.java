package app.lector.recommend;

import app.lector.common.ApiException;
import app.lector.text.Category;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.user.User;
import java.time.Clock;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecommendationFeedback {

    static final int MAX_EVENT_ITEMS = 100;

    public record EventItem(Long textId, Integer position, ScoreParts parts) {}

    private final TextDismissalRepository dismissals;
    private final UserInterestRepository interests;
    private final RecommendationEventRepository events;
    private final TextRepository texts;
    private final TextService textService;
    private final Clock clock;

    public RecommendationFeedback(TextDismissalRepository dismissals, UserInterestRepository interests,
                                  RecommendationEventRepository events, TextRepository texts, TextService textService,
                                  Clock clock) {
        this.dismissals = dismissals;
        this.interests = interests;
        this.events = events;
        this.texts = texts;
        this.textService = textService;
        this.clock = clock;
    }

    @Transactional
    public void notInterested(User user, Long textId) {
        textService.loadReadable(user, textId);
        if (dismissals.findByUserIdAndTextId(user.getId(), textId).isEmpty()) {
            dismissals.save(new TextDismissal(user.getId(), textId, clock.instant()));
        }
    }

    @Transactional
    public void undoNotInterested(User user, Long textId) {
        dismissals.findByUserIdAndTextId(user.getId(), textId).ifPresent(dismissals::delete);
    }

    @Transactional(readOnly = true)
    public List<Category> interests(User user) {
        Set<Category> set = EnumSet.noneOf(Category.class);
        interests.findByUserId(user.getId()).forEach(i -> set.add(i.getCategory()));
        return List.copyOf(set);
    }

    @Transactional
    public List<Category> setInterests(User user, Collection<Category> categories) {
        if (categories == null || categories.contains(null)) {
            throw ApiException.badRequest("categories must be a list of category codes");
        }
        interests.deleteByUserId(user.getId());
        interests.flush();
        Set<Category> set = EnumSet.noneOf(Category.class);
        set.addAll(categories);
        set.forEach(c -> interests.save(new UserInterest(user.getId(), c)));
        return List.copyOf(set);
    }

    @Transactional
    public void log(User user, String type, String shelf, List<EventItem> items) {
        RecommendationEvent.Type kind = type(type);
        ShelfId shelfId;
        try {
            shelfId = ShelfId.parse(shelf);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest(e.getMessage());
        }
        check(items);
        Map<Long, Text> readable = texts.findAllById(items.stream().map(EventItem::textId).collect(Collectors.toSet()))
                .stream().filter(t -> textService.canRead(user, t)).collect(Collectors.toMap(Text::getId, t -> t));
        for (EventItem item : items) {
            if (readable.containsKey(item.textId())) {
                RecommendationEvent event = new RecommendationEvent(user.getId(), item.textId(), shelfId,
                        item.position(), kind, clock.instant());
                if (item.parts() != null && kind == RecommendationEvent.Type.IMPRESSION) {
                    event.setParts(item.parts().values());
                }
                events.save(event);
            }
        }
    }

    private static void check(List<EventItem> items) {
        if (items == null || items.isEmpty() || items.size() > MAX_EVENT_ITEMS) {
            throw ApiException.badRequest("items must hold 1 to " + MAX_EVENT_ITEMS + " cards");
        }
        if (items.stream().anyMatch(i -> i.textId() == null || i.position() == null || i.position() < 0)) {
            throw ApiException.badRequest("each item needs a textId and a position of 0 or more");
        }
        if (items.stream().anyMatch(i -> i.parts() != null && !i.parts().valid())) {
            throw ApiException.badRequest("score parts need all seven parts, each from " + ScoreParts.MIN + " to "
                    + ScoreParts.MAX);
        }
    }

    private static RecommendationEvent.Type type(String type) {
        if ("impression".equals(type) || "open".equals(type)) {
            return RecommendationEvent.Type.valueOf(type.toUpperCase(Locale.ROOT));
        }
        throw ApiException.badRequest("type must be impression or open");
    }
}
