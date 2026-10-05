package app.lector.recommend;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Explore recommendations (app.recommend.*): every weight and limit of the ranking, and the feature job. */
@ConfigurationProperties(prefix = "app.recommend")
public record RecommendProperties(
        @DefaultValue Weights weights,
        /* Signals lose half their weight every this many days; so does freshness. */
        @DefaultValue("30") double halfLifeDays,
        /* Every this-many-th slot of "For you" explores outside the usual topics (7: about 15%). 0 turns it off. */
        @DefaultValue("7") int exploreEvery,
        /* At most this many in a row from one category or creator. */
        @DefaultValue("2") int maxRun,
        @DefaultValue("12") int forYouSize,
        @DefaultValue("8") int shelfSize,
        /* "Because you read" only lists items at least this similar to the text read. */
        @DefaultValue("0.2") double minSimilarity,
        /* Run the tagging and embedding job on a schedule. */
        @DefaultValue("true") boolean featureJob,
        @DefaultValue("60s") Duration featureJobDelay,
        /* Texts tagged and embedded per run. */
        @DefaultValue("20") int featureBatch) {
}
