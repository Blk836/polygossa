package app.lector.recommend;

import app.lector.text.Category;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Picks and orders the items of each personalised shelf from scored candidates, with each card's reason. Pure:
 * candidates come in id order, so equal scores always resolve the same way.
 */
final class ShelfBuilder {

    /** An item on a shelf and why it is there. */
    record Pick(Candidate candidate, Reason reason) {}

    /** "More about …": a topic tag, or a category when no tag has items. */
    record TopicShelf(String topic, Category category, List<Pick> picks) {}

    static final double JUST_RIGHT_MIN = 90;
    static final double JUST_RIGHT_MAX = 98;
    static final double STRETCH_MIN = 85;

    private static final Comparator<Candidate> BY_SCORE = Comparator.comparingDouble(Candidate::score).reversed();

    private ShelfBuilder() {}

    static List<Pick> forYou(List<Candidate> candidates, TasteProfile profile, RecommendProperties props,
                             boolean levelKnown) {
        List<Candidate> feed = Diversity.arrange(candidates.stream().map(Candidate::slot).toList(),
                props.forYouSize(), props.exploreEvery(), props.maxRun());
        List<Pick> picks = new ArrayList<>();
        for (int i = 0; i < feed.size(); i++) {
            Candidate c = feed.get(i);
            boolean exploring = props.exploreEvery() > 0 && (i + 1) % props.exploreEvery() == 0
                    && profile.hasTopics() && c.outsideTopics();
            picks.add(new Pick(c, exploring ? Reason.simple("explore") : reason(c, profile, props.weights(), levelKnown)));
        }
        return picks;
    }

    /** Candidates most like the anchor (similarity above the minimum), most similar first. */
    static List<Pick> because(long anchorId, float[] anchorVector, String title, boolean liked,
                              List<Candidate> candidates, RecommendProperties props) {
        record Similar(Candidate c, double similarity) {}
        return candidates.stream()
                .filter(c -> c.id() != anchorId)
                .map(c -> new Similar(c, Scoring.cosine(anchorVector, c.vector())))
                .filter(s -> s.similarity() > props.minSimilarity())
                .sorted(Comparator.comparingDouble(Similar::similarity).reversed())
                .limit(props.shelfSize())
                .map(s -> new Pick(s.c(), Reason.because(title, liked)))
                .toList();
    }

    /** The learner's strongest topic tag that has items; else their strongest category that has items. */
    static Optional<TopicShelf> topic(TasteProfile profile, List<Candidate> candidates, RecommendProperties props) {
        for (String topic : profile.topicsByStrength()) {
            List<Pick> picks = best(candidates, c -> c.topics().contains(topic), props, c -> Reason.topic(topic));
            if (!picks.isEmpty()) {
                return Optional.of(new TopicShelf(topic, null, picks));
            }
        }
        for (Category category : profile.categoriesByStrength()) {
            List<Pick> picks = best(candidates, c -> c.category() == category, props, c -> Reason.category(category));
            if (!picks.isEmpty()) {
                return Optional.of(new TopicShelf(null, category, picks));
            }
        }
        return Optional.empty();
    }

    /** 90–98% known, best comprehension fit first. */
    static List<Pick> justRight(List<Candidate> candidates, RecommendProperties props) {
        return candidates.stream()
                .filter(c -> c.knownPercent() >= JUST_RIGHT_MIN && c.knownPercent() <= JUST_RIGHT_MAX)
                .sorted(Comparator.comparingDouble((Candidate c) -> c.parts().comprehension()).reversed()
                        .thenComparing(BY_SCORE))
                .limit(props.shelfSize())
                .map(c -> new Pick(c, Reason.known(c.knownPercent())))
                .toList();
    }

    /** 85–90% known, in the learner's topics (any topic when they have none), best score first. */
    static List<Pick> stretch(List<Candidate> candidates, TasteProfile profile, RecommendProperties props) {
        return best(candidates, c -> c.knownPercent() >= STRETCH_MIN && c.knownPercent() < JUST_RIGHT_MIN
                && (!profile.hasTopics() || profile.inTopics(c.topics(), c.category())), props,
                c -> Reason.known(c.knownPercent()));
    }

    private static List<Pick> best(List<Candidate> candidates, Predicate<Candidate> keep, RecommendProperties props,
                                   java.util.function.Function<Candidate, Reason> reason) {
        return candidates.stream().filter(keep).sorted(BY_SCORE).limit(props.shelfSize())
                .map(c -> new Pick(c, reason.apply(c))).toList();
    }

    /** The reason named by the part that adds most to the score; "new" when nothing adds anything. */
    static Reason reason(Candidate c, TasteProfile profile, Weights w, boolean levelKnown) {
        Scoring.Parts p = c.parts();
        // An unknown level is the same for every item, so it says nothing about this one.
        Scoring.Parts shown = new Scoring.Parts(p.interest(), p.topic(), p.comprehension(), levelKnown ? p.level() : 0,
                p.popular(), p.fresh(), p.format(), 0);
        Scoring.Part part = Scoring.strongest(shown, w);
        if (Scoring.weighted(shown, w)[part.ordinal()] <= 0) {
            return Reason.simple("new");
        }
        return reason(part, c, profile);
    }

    private static Reason reason(Scoring.Part part, Candidate c, TasteProfile profile) {
        return switch (part) {
            case INTEREST, FORMAT -> Reason.simple("similar");
            case TOPIC -> profile.favouriteTag(c.topics()).map(Reason::topic).orElse(Reason.category(c.category()));
            case COMPREHENSION -> Reason.known(c.knownPercent());
            case LEVEL -> Reason.level(c.level());
            case POPULAR -> Reason.popular(c.likes());
            case FRESH -> Reason.simple("new");
        };
    }
}
