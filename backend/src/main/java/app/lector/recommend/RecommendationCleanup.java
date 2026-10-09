package app.lector.recommend;

import app.lector.text.TextDeleted;
import app.lector.text.TextFeatureRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class RecommendationCleanup {

    private final TextFeatureRepository features;
    private final TextDismissalRepository dismissals;
    private final RecommendationEventRepository events;

    RecommendationCleanup(TextFeatureRepository features, TextDismissalRepository dismissals,
                          RecommendationEventRepository events) {
        this.features = features;
        this.dismissals = dismissals;
        this.events = events;
    }

    @EventListener
    void onDeleted(TextDeleted deleted) {
        features.deleteByTextId(deleted.textId());
        dismissals.deleteByTextId(deleted.textId());
        events.deleteByTextId(deleted.textId());
    }
}
