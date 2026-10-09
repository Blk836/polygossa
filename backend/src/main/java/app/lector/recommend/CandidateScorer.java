package app.lector.recommend;

import app.lector.recommend.FeatureCache.Features;
import app.lector.recommend.RecommendationEventRepository.TextTally;
import app.lector.text.Text;
import app.lector.text.TextDtos.KnownStats;
import java.time.Duration;
import java.time.Instant;

final class CandidateScorer {

    private final TasteProfile profile;
    private final String readingLevel;
    private final Instant now;
    private final RecommendProperties props;

    CandidateScorer(TasteProfile profile, String readingLevel, Instant now, RecommendProperties props) {
        this.profile = profile;
        this.readingLevel = readingLevel;
        this.now = now;
        this.props = props;
    }

    Candidate score(Text t, KnownStats stats, Features f, long recentLikes, TextTally tally) {
        int impressions = tally == null ? 0 : (int) tally.getImpressions();
        int opens = tally == null ? 0 : (int) tally.getOpens();
        Scoring.Parts parts = new Scoring.Parts(
                Scoring.cosine(profile.taste(), f.vector()),
                profile.affinity(f.topics(), t.getCategory()),
                Scoring.comprehensionFit(stats.knownPercent()),
                Scoring.levelFit(readingLevel, t.getCefrLevel()),
                Scoring.popularity(recentLikes),
                Scoring.decay(Duration.between(t.getCreatedAt(), now), props.halfLifeDays()),
                profile.formatAffinity(t.isVideo(), t.getWordCount()),
                Signals.impressionPenalty(impressions, opens));
        return new Candidate(t.getId(), t.getCategory(), t.getOwner().getId(), t.getCefrLevel(), stats.knownPercent(),
                recentLikes, f.topics(), f.vector(), parts, Scoring.score(parts, props.weights()),
                Scoring.exploreScore(parts, props.weights()), !profile.inTopics(f.topics(), t.getCategory()));
    }
}
