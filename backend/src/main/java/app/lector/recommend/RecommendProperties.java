package app.lector.recommend;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.recommend")
public record RecommendProperties(
        @DefaultValue Weights weights,
        @DefaultValue("30") double halfLifeDays,
        @DefaultValue("7") int exploreEvery,
        @DefaultValue("2") int maxRun,
        @DefaultValue("12") int forYouSize,
        @DefaultValue("8") int shelfSize,
        @DefaultValue("0.2") double minSimilarity,
        @DefaultValue("true") boolean featureJob,
        @DefaultValue("60s") Duration featureJobDelay,
        @DefaultValue("20") int featureBatch,
        @DefaultValue Learn learn) {

    public record Learn(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("28") int days,
            @DefaultValue("open") String outcome,
            @DefaultValue("true") boolean schedule) {}

    public RecommendProperties withWeights(Weights w) {
        return new RecommendProperties(w, halfLifeDays, exploreEvery, maxRun, forYouSize, shelfSize, minSimilarity,
                featureJob, featureJobDelay, featureBatch, learn);
    }
}
