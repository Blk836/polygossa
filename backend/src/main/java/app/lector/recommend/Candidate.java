package app.lector.recommend;

import app.lector.text.Category;
import java.util.List;

/**
 * A public item that can be recommended, with what ranking needs: its card facts, features and scored parts.
 * {@code vector} is null without an embedding from the current model.
 */
public record Candidate(long id, Category category, Long creator, String level, double knownPercent, long likes,
                        List<String> topics, float[] vector, Scoring.Parts parts, double score, double exploreScore,
                        boolean outsideTopics) {

    Diversity.Slot<Candidate> slot() {
        return new Diversity.Slot<>(this, category.code(), creator, score, exploreScore, outsideTopics);
    }
}
