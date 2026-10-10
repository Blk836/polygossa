package app.lector.recommend;

import app.lector.text.TextFeature;
import app.lector.text.TextFeatureRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class FeatureCache {

    static final int MAX_TEXTS = 20_000;

    public record Features(float[] vector, List<String> topics) {
        static final Features NONE = new Features(null, List.of());
    }

    private record Cached(long version, float[] vector, String model, List<String> topics) {}

    private final TextFeatureRepository repository;
    private final Map<Long, Cached> entries = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<Long, Cached> eldest) {
            return size() > MAX_TEXTS;
        }
    };

    public FeatureCache(TextFeatureRepository repository) {
        this.repository = repository;
    }

    public Map<Long, Features> get(Collection<Long> textIds, String model) {
        Map<Long, Features> out = new HashMap<>();
        if (textIds.isEmpty()) {
            return out;
        }
        List<Long> stale = new ArrayList<>();
        for (TextFeatureRepository.Stamp stamp : repository.findStamps(textIds)) {
            Cached e = cached(stamp.getTextId());
            if (e == null || e.version() != stamp.getVersion()) {
                stale.add(stamp.getTextId());
            } else {
                out.put(stamp.getTextId(), features(e, model));
            }
        }
        if (!stale.isEmpty()) {
            for (TextFeature f : repository.findByTextIdIn(stale)) {
                Cached e = new Cached(f.getVersion(), f.vector(), f.getEmbeddingModel(), f.getTopics());
                synchronized (entries) {
                    entries.put(f.getTextId(), e);
                }
                out.put(f.getTextId(), features(e, model));
            }
        }
        return out;
    }

    private Cached cached(Long textId) {
        synchronized (entries) {
            return entries.get(textId);
        }
    }

    private static Features features(Cached e, String model) {
        return new Features(model.equals(e.model()) ? e.vector() : null, e.topics());
    }
}
