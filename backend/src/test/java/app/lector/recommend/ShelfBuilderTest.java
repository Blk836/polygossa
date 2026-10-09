package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.recommend.Scoring.Parts;
import app.lector.recommend.TasteProfile.Engaged;
import app.lector.text.Category;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ShelfBuilderTest {

    private static final Weights EQUAL = new Weights(1, 1, 1, 1, 1, 1, 1);
    private static final TasteProfile NO_HISTORY = TasteProfile.of(List.of(), Set.of(), List.of());
    private static final TasteProfile LIKES_COOKING = TasteProfile.of(
            List.of(new Engaged(3, null, List.of("cooking"), Category.FOOD, false, 500)), Set.of(), List.of());

    private static Candidate candidate(long id, Category category, List<String> topics, Parts parts) {
        return new Candidate(id, category, id, "B1", 96.0, 4, topics, null, parts, Scoring.score(parts, EQUAL),
                Scoring.exploreScore(parts, EQUAL), false);
    }

    private static Parts only(int index, double value) {
        double[] v = new double[7];
        v[index] = value;
        return new Parts(v[0], v[1], v[2], v[3], v[4], v[5], v[6], 0);
    }

    private static Reason reason(int part, double value, boolean levelKnown) {
        return ShelfBuilder.reason(candidate(1, Category.FOOD, List.of("cooking", "spain"), only(part, value)),
                LIKES_COOKING, EQUAL, levelKnown);
    }

    @Test
    void theStrongestPartNamesTheReason() {
        assertThat(reason(0, 0.9, true)).isEqualTo(Reason.simple("similar"));
        assertThat(reason(1, 0.9, true)).isEqualTo(Reason.topic("cooking"));
        assertThat(reason(2, 0.9, true)).isEqualTo(Reason.known(96.0));
        assertThat(reason(3, 0.9, true)).extracting(Reason::kind, Reason::level).containsExactly("level", "B1");
        assertThat(reason(4, 0.9, true)).extracting(Reason::kind, Reason::likes).containsExactly("popular", 4L);
        assertThat(reason(5, 0.9, true)).isEqualTo(Reason.simple("new"));
        assertThat(reason(6, 0.9, true)).isEqualTo(Reason.simple("similar"));
    }

    @Test
    void aTopicReasonFallsBackToTheCategoryWithoutALikedTag() {
        Candidate c = candidate(1, Category.TRAVEL, List.of("trains"), only(1, 0.9));
        assertThat(ShelfBuilder.reason(c, LIKES_COOKING, EQUAL, true)).isEqualTo(Reason.category(Category.TRAVEL));
    }

    @Test
    void anUnknownReadingLevelNeverNamesTheReason() {
        Parts parts = new Parts(0, 0, 0.2, 0.9, 0, 0, 0, 0);
        Candidate c = candidate(1, Category.FOOD, List.of(), parts);
        assertThat(ShelfBuilder.reason(c, NO_HISTORY, EQUAL, false)).isEqualTo(Reason.known(96.0));
        assertThat(ShelfBuilder.reason(c, NO_HISTORY, EQUAL, true)).isEqualTo(Reason.level("B1"));
    }

    @Test
    void nothingAddingAnythingMeansNew() {
        assertThat(reason(0, 0, true)).isEqualTo(Reason.simple("new"));
        assertThat(reason(0, -0.5, true)).isEqualTo(Reason.simple("new"));
        assertThat(reason(3, 0.9, false)).isEqualTo(Reason.simple("new"));
    }

    private static RecommendProperties props(int exploreEvery) {
        return new RecommendProperties(EQUAL, 30, exploreEvery, 2, 12, 8, 0.2, false, Duration.ofSeconds(60), 20,
                new RecommendProperties.Learn(false, 28, "open", false));
    }

    private static Candidate ranked(long id, double score, boolean outside) {
        Parts p = only(2, score);
        return new Candidate(id, Category.values()[(int) id % 10], id, "B1", 96.0, 0, List.of(), null, p, score, score,
                outside);
    }

    @Test
    void anExplorationSlotSaysSomethingDifferentOnlyWhenItIsOutsideKnownTopics() {
        List<Candidate> cs = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            cs.add(ranked(i, 1.0 - i * 0.1, i == 3));
        }
        List<ShelfBuilder.Pick> withTopics = ShelfBuilder.forYou(cs, LIKES_COOKING, props(3), true);
        assertThat(withTopics.get(2).reason()).isEqualTo(Reason.simple("explore"));
        assertThat(withTopics.get(0).reason()).isEqualTo(Reason.known(96.0));
        assertThat(ShelfBuilder.forYou(cs, NO_HISTORY, props(3), true).get(2).reason()).isEqualTo(Reason.known(96.0));
        List<Candidate> inside = cs.stream().map(c -> ranked(c.id(), c.score(), false)).toList();
        assertThat(ShelfBuilder.forYou(inside, LIKES_COOKING, props(3), true).get(2).reason())
                .isEqualTo(Reason.known(96.0));
        assertThat(ShelfBuilder.forYou(cs, LIKES_COOKING, props(0), true)).extracting(ShelfBuilder.Pick::reason)
                .doesNotContain(Reason.simple("explore"));
    }
}
