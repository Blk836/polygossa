package app.lector.recommend;

import app.lector.text.Category;
import java.util.List;

public record Candidate(long id, Category category, Long creator, String level, double knownPercent, long likes,
                        List<String> topics, float[] vector, Scoring.Parts parts, double score, double exploreScore,
                        boolean outsideTopics) {

    Diversity.Slot<Candidate> slot() {
        return new Diversity.Slot<>(this, category.code(), creator, score, exploreScore, outsideTopics);
    }
}
