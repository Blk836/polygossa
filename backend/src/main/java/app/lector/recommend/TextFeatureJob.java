package app.lector.recommend;

import app.lector.ai.AiClient;
import app.lector.ai.AiJob;
import app.lector.ai.EmbeddingClient;
import app.lector.common.JobLock;
import app.lector.text.TextFeature;
import app.lector.text.TextFeatureRepository;
import app.lector.text.TextRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class TextFeatureJob {

    private static final Logger log = LoggerFactory.getLogger(TextFeatureJob.class);
    private static final long MAX_BACKOFF_MINUTES = 24 * 60;
    public static final String LOCK = "text-features";

    private record Source(String language, String title, String content) {}

    private final TextFeatureRepository features;
    private final TextRepository texts;
    private final AiClient ai;
    private final EmbeddingClient embeddings;
    private final Clock clock;
    private final RecommendProperties props;
    private final TransactionTemplate tx;
    private final JobLock lock;

    public TextFeatureJob(TextFeatureRepository features, TextRepository texts, AiClient ai, EmbeddingClient embeddings,
                          Clock clock, RecommendProperties props, TransactionTemplate tx, JobLock lock) {
        this.lock = lock;
        this.features = features;
        this.texts = texts;
        this.ai = ai;
        this.embeddings = embeddings;
        this.clock = clock;
        this.props = props;
        this.tx = tx;
    }

    @Scheduled(fixedDelayString = "${app.recommend.feature-job-delay:60s}",
            initialDelayString = "${app.recommend.feature-job-delay:60s}")
    public void scheduled() {
        if (props.featureJob()) {
            runAlone();
        }
    }

    public Optional<Integer> runAlone() {
        return lock.runAlone(LOCK, this::runOnce);
    }

    public int runOnce() {
        if (!ai.enabled() || !ai.systemBudgetLeft()) {
            return 0;
        }
        Instant now = clock.instant();
        int batch = props.featureBatch();
        List<Long> ids = new ArrayList<>(features.findPublicWithoutFeatures(PageRequest.of(0, batch)));
        if (ids.size() < batch) {
            ids.addAll(features.findDue(embeddings.model(), now, PageRequest.of(0, batch - ids.size())));
        }
        int processed = 0;
        for (Long id : ids) {
            if (!ai.systemBudgetLeft()) {
                break;
            }
            process(id, now);
            processed++;
        }
        return processed;
    }

    private void process(Long textId, Instant now) {
        Source source = tx.execute(status -> texts.findById(textId)
                .map(t -> new Source(t.getLanguage().displayName(), t.getTitle(), TopicTagger.excerpt(t.getContent())))
                .orElse(null));
        if (source == null) {
            return;
        }
        TextFeature f = features.findByTextId(textId).orElseGet(() -> new TextFeature(textId));
        boolean ok = tag(f, source) & embed(f, source);
        f.attempted(ok, now, ok ? null : now.plus(backoff(f.getAttempts() + 1)));
        features.save(f);
    }

    private boolean tag(TextFeature f, Source s) {
        if (f.getTagModel() != null) {
            return true;
        }
        try {
            TopicTagger.Tags t = TopicTagger.parse(ai.completeJson(AiJob.TOPIC_TAGS, TopicTagger.SYSTEM,
                    TopicTagger.user(s.language(), s.title(), s.content()), 0));
            f.withTags(t.topics(), t.summary(), t.register(), t.suitableFor(), ai.model());
            return true;
        } catch (RuntimeException e) {
            log.warn("Could not tag text {}: {}", f.getTextId(), e.getMessage());
            return false;
        }
    }

    private boolean embed(TextFeature f, Source s) {
        if (f.vector() != null && embeddings.model().equals(f.getEmbeddingModel())) {
            return true;
        }
        try {
            f.withEmbedding(embeddings.embed(TopicTagger.embeddingInput(s.title(), f.getSummary(), s.content())),
                    embeddings.model());
            return true;
        } catch (RuntimeException e) {
            log.warn("Could not embed text {}: {}", f.getTextId(), e.getMessage());
            return false;
        }
    }

    static Duration backoff(int attempts) {
        return Duration.ofMinutes(Math.min(1L << Math.min(attempts, 20), MAX_BACKOFF_MINUTES));
    }
}
