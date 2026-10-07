package app.lector.recommend;

import app.lector.common.ApiException;
import app.lector.progress.ReadingProgressRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fits score weights to the logged impressions ({@link WeightLearner}) on request, and, when learning is switched on,
 * at start-up and then daily, handing the result to {@link ActiveWeights} for ranking.
 */
@Service
public class WeightLearningJob {

    private static final Logger log = LoggerFactory.getLogger(WeightLearningJob.class);

    /** The fit, as GET /api/recommendations/weights reports it; learned is null without enough data. */
    public record Fit(int days, String outcome, int examples, long positives, Weights configured, Weights learned,
                      String using) {}

    private final RecommendationEventRepository events;
    private final ReadingProgressRepository progress;
    private final ActiveWeights active;
    private final RecommendProperties props;
    private final Clock clock;

    public WeightLearningJob(RecommendationEventRepository events, ReadingProgressRepository progress,
                             ActiveWeights active, RecommendProperties props, Clock clock) {
        this.events = events;
        this.progress = progress;
        this.active = active;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "${app.recommend.learn.initial-delay:30s}",
            fixedDelayString = "${app.recommend.learn.every:24h}")
    public void scheduled() {
        if (props.learn().enabled() && props.learn().schedule()) {
            runOnce();
        }
    }

    /** Fits with the configured window and outcome and updates the weights ranking uses. */
    @Transactional(readOnly = true)
    public Optional<Weights> runOnce() {
        Fit fit = fit(props.learn().days(), props.learn().outcome());
        active.update(Optional.ofNullable(fit.learned()));
        log.info("Learned recommendation weights from {} examples: {}", fit.examples(),
                fit.learned() == null ? "not enough data, using the configured weights" : fit.learned());
        return Optional.ofNullable(fit.learned());
    }

    @Transactional(readOnly = true)
    public Fit fit(int days, String outcomeCode) {
        if (days < 1 || days > 365) {
            throw ApiException.badRequest("days must be 1 to 365");
        }
        TrainingSet.Outcome outcome = TrainingSet.Outcome.parse(outcomeCode);
        List<TrainingSet.Event> logged = events.findByCreatedAtGreaterThanEqualOrderByIdAsc(
                        clock.instant().minus(Duration.ofDays(days))).stream()
                .map(e -> new TrainingSet.Event(e.getUserId(), e.getTextId(),
                        e.getType() == RecommendationEvent.Type.OPEN, e.getPosition(), e.parts(), e.getCreatedAt()))
                .toList();
        List<WeightLearner.Example> examples = TrainingSet.examples(logged, outcome,
                outcome == TrainingSet.Outcome.HALF ? reached(logged) : Map.of());
        Weights learned = WeightLearner.learn(examples, active.configured()).orElse(null);
        return new Fit(days, outcome.code(), examples.size(), examples.stream().filter(WeightLearner.Example::opened)
                .count(), active.configured(), learned, active.using());
    }

    private Map<String, TrainingSet.Reached> reached(List<TrainingSet.Event> logged) {
        Set<Long> users = logged.stream().filter(TrainingSet.Event::open).map(TrainingSet.Event::userId)
                .collect(Collectors.toSet());
        Set<Long> texts = logged.stream().filter(TrainingSet.Event::open).map(TrainingSet.Event::textId)
                .collect(Collectors.toSet());
        if (users.isEmpty()) {
            return Map.of();
        }
        return progress.findForUsersAndTexts(users, texts).stream().collect(Collectors.toMap(
                p -> p.getUserId() + ":" + p.getTextId(), p -> new TrainingSet.Reached(p.getPercent(), p.isCompleted())));
    }
}
