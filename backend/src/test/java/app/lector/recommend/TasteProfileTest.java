package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import app.lector.recommend.TasteProfile.Engaged;
import app.lector.text.Category;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Feature: Explore recommendations, the learner's taste (docs/acceptance/explore-recommendations.feature). */
class TasteProfileTest {

    private static Engaged engaged(double weight, float[] vector, Category category, String... topics) {
        return new Engaged(weight, vector, List.of(topics), category, false, 500);
    }

    private static Engaged format(double weight, boolean video, int words) {
        return new Engaged(weight, null, List.of(), Category.OTHER, video, words);
    }

    private static TasteProfile of(Engaged... engaged) {
        return TasteProfile.of(List.of(engaged), Set.of(), List.of());
    }

    // ---- taste vector ----

    @Test
    void theTasteIsTheWeightedAverageOfWhatWasEnjoyed() {
        TasteProfile p = of(engaged(1, new float[] {1, 0}, Category.FOOD), engaged(3, new float[] {0, 1}, Category.FOOD));
        assertThat(p.taste()).containsExactly(0.25f, 0.75f);
    }

    @Test
    void dislikedAndUnembeddedTextsDontShapeTheTaste() {
        TasteProfile p = of(engaged(2, new float[] {1, 0}, Category.FOOD), engaged(-4, new float[] {0, 1}, Category.NEWS),
                engaged(0, new float[] {0, 1}, Category.NEWS), engaged(5, null, Category.NEWS));
        assertThat(p.taste()).containsExactly(1f, 0f);
    }

    @Test
    void vectorsOfAnotherSizeAreIgnored() {
        TasteProfile p = of(engaged(1, new float[] {1, 0}, Category.FOOD), engaged(1, new float[] {0, 1, 0}, Category.FOOD));
        assertThat(p.taste()).containsExactly(1f, 0f);
    }

    @Test
    void noHistoryAndNoInterestsMeansNoTaste() {
        assertThat(of().taste()).isNull();
        assertThat(of(engaged(-1, new float[] {1}, Category.FOOD)).taste()).isNull();
    }

    @Test
    void withoutHistoryTheInterestVectorsSeedTheTaste() {
        TasteProfile p = TasteProfile.of(List.of(), Set.of(Category.FOOD),
                List.of(new float[] {1, 0}, new float[] {0, 1}));
        assertThat(p.taste()).containsExactly(0.5f, 0.5f);
    }

    @Test
    void historyWinsOverInterestVectors() {
        TasteProfile p = TasteProfile.of(List.of(engaged(1, new float[] {0, 1}, Category.NEWS)), Set.of(Category.FOOD),
                List.of(new float[] {1, 0}));
        assertThat(p.taste()).containsExactly(0f, 1f);
    }

    // ---- topics and categories ----

    @Test
    void topicAffinityIsTheMeanNormalisedWeightOfTheItemsTagsAndCategory() {
        TasteProfile p = of(engaged(4, null, Category.FOOD, "cooking", "spain"), engaged(-2, null, Category.NEWS, "politics"));
        // weights: cooking 4, spain 4, category:food 4, politics -2, category:news -2; max |w| = 4
        assertThat(p.affinity(List.of("cooking"), Category.FOOD)).isCloseTo(1, within(1e-9));
        assertThat(p.affinity(List.of("cooking", "football"), Category.FOOD)).isCloseTo(2.0 / 3, within(1e-9));
        assertThat(p.affinity(List.of("politics"), Category.NEWS)).isCloseTo(-0.5, within(1e-9));
        assertThat(p.affinity(List.of(), Category.TRAVEL)).isZero();
        assertThat(p.affinity(List.of(), Category.FOOD)).isCloseTo(1, within(1e-9));
    }

    @Test
    void noTopicHistoryMeansNeutralAffinity() {
        assertThat(of().affinity(List.of("cooking"), Category.FOOD)).isZero();
        assertThat(of().hasTopics()).isFalse();
        assertThat(of(engaged(0, null, Category.FOOD, "cooking")).hasTopics()).isFalse();
    }

    @Test
    void interestsCountTwoPerCategory() {
        TasteProfile p = TasteProfile.of(List.of(engaged(1, null, Category.NEWS, "politics")),
                Set.of(Category.FOOD, Category.TRAVEL), List.of());
        assertThat(p.affinity(List.of(), Category.FOOD)).isCloseTo(1, within(1e-9));
        assertThat(p.affinity(List.of("politics"), Category.NEWS)).isCloseTo(0.5, within(1e-9));
        assertThat(p.hasTopics()).isTrue();
        assertThat(p.inTopics(List.of(), Category.TRAVEL)).isTrue();
        assertThat(p.inTopics(List.of(), Category.HISTORY)).isFalse();
    }

    @Test
    void theStrongestTopicIsTheTagWithTheHighestPositiveWeight() {
        TasteProfile p = of(engaged(2, null, Category.FOOD, "cooking"), engaged(3, null, Category.FOOD, "wine"),
                engaged(1, null, Category.NEWS, "politics"));
        assertThat(p.strongestTopic()).contains("wine");
        assertThat(p.strongestCategory()).contains(Category.FOOD);
    }

    @Test
    void noPositiveTopicsMeansNoStrongestTopic() {
        TasteProfile p = of(engaged(-4, null, Category.FOOD, "cooking"));
        assertThat(p.strongestTopic()).isEmpty();
        assertThat(p.strongestCategory()).isEmpty();
        assertThat(of(engaged(2, null, Category.FOOD)).strongestTopic()).isEmpty();
        assertThat(of(engaged(2, null, Category.FOOD)).strongestCategory()).contains(Category.FOOD);
    }

    @Test
    void tiesGoToTheAlphabeticallyFirstTopicAndTheFirstCategoryInShelfOrder() {
        TasteProfile p = of(engaged(2, null, Category.FOOD, "wine", "cooking"));
        assertThat(p.strongestTopic()).contains("cooking");
        TasteProfile q = TasteProfile.of(List.of(), Set.of(Category.TRAVEL, Category.FOOD), List.of());
        assertThat(q.strongestCategory()).contains(Category.TRAVEL);
    }

    @Test
    void topicsAndCategoriesByStrengthListOnlyPositiveOnes() {
        TasteProfile p = of(engaged(2, null, Category.FOOD, "cooking"), engaged(3, null, Category.TRAVEL, "wine"),
                engaged(-1, null, Category.NEWS, "politics"));
        assertThat(p.topicsByStrength()).containsExactly("wine", "cooking");
        assertThat(p.categoriesByStrength()).containsExactly(Category.TRAVEL, Category.FOOD);
    }

    @Test
    void theFavouriteTagIsTheItemsTagILikeMost() {
        TasteProfile p = of(engaged(2, null, Category.FOOD, "cooking"), engaged(3, null, Category.FOOD, "wine"),
                engaged(-1, null, Category.NEWS, "politics"));
        assertThat(p.favouriteTag(List.of("cooking", "wine", "cheese"))).contains("wine");
        assertThat(p.favouriteTag(List.of("politics", "cheese"))).isEmpty();
        assertThat(p.favouriteTag(List.of())).isEmpty();
    }

    // ---- format ----

    @Test
    void formatAffinityFromWhatWasEnjoyed() {
        TasteProfile p = of(format(3, true, 200), format(1, false, 5000));
        // kind: video (3 - 1) / 4 = 0.5; length: short (3 - 1) / 4 = 0.5
        assertThat(p.formatAffinity(true, 100)).isCloseTo(0.5, within(1e-9));
        // text: (1 - 3) / 4; long: (1 - 3) / 4
        assertThat(p.formatAffinity(false, 2000)).isCloseTo(-0.5, within(1e-9));
        // video, but medium length: (0.5 + (0 - 4) / 4) / 2
        assertThat(p.formatAffinity(true, 800)).isCloseTo(-0.25, within(1e-9));
    }

    @Test
    void lengthBucketsAreUnderThreeHundredUnderFifteenHundredAndLonger() {
        TasteProfile p = of(format(1, false, 299), format(1, false, 300), format(1, false, 1499), format(1, false, 1500));
        // kind: all text; length: each bucket gets its own weight against the rest
        assertThat(p.formatAffinity(false, 0)).isCloseTo((1 + (1 - 3) / 4.0) / 2, within(1e-9));
        assertThat(p.formatAffinity(false, 1000)).isCloseTo((1 + (2 - 2) / 4.0) / 2, within(1e-9));
        assertThat(p.formatAffinity(false, 9000)).isCloseTo((1 + (1 - 3) / 4.0) / 2, within(1e-9));
    }

    @Test
    void noPositiveHistoryMeansNeutralFormat() {
        assertThat(of().formatAffinity(true, 100)).isZero();
        assertThat(of(format(-4, true, 100)).formatAffinity(true, 100)).isZero();
    }
}
