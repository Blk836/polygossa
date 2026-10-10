package app.lector.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.recommend.Diversity.Slot;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DiversityTest {

    private static Slot<String> slot(String id, String category, long creator, double score) {
        return new Slot<>(id, category, creator, score, score, false);
    }

    private static Slot<String> outside(String id, String category, long creator, double score, double explore) {
        return new Slot<>(id, category, creator, score, explore, true);
    }

    private static List<String> arrange(List<Slot<String>> slots, int size) {
        return Diversity.arrange(slots, size, 0, 2);
    }

    @Test
    void withoutConflictsItemsFollowTheirScore() {
        List<Slot<String>> slots = List.of(slot("b", "news", 2, 0.5), slot("a", "food", 1, 0.9), slot("c", "travel", 3, 0.1));
        assertThat(arrange(slots, 10)).containsExactly("a", "b", "c");
    }

    @Test
    void theSizeLimitsTheResult() {
        List<Slot<String>> slots = List.of(slot("a", "food", 1, 0.9), slot("b", "news", 2, 0.5), slot("c", "travel", 3, 0.1));
        assertThat(arrange(slots, 2)).containsExactly("a", "b");
        assertThat(arrange(slots, 0)).isEmpty();
        assertThat(arrange(List.of(), 5)).isEmpty();
    }

    @Test
    void equalScoresKeepTheirInputOrder() {
        List<Slot<String>> slots = List.of(slot("x", "food", 1, 0.5), slot("y", "news", 2, 0.5), slot("z", "travel", 3, 0.5));
        assertThat(arrange(slots, 3)).containsExactly("x", "y", "z");
    }

    @Test
    void neverThreeInARowFromOneCategory() {
        List<Slot<String>> slots = List.of(slot("f1", "food", 1, 0.9), slot("f2", "food", 2, 0.8), slot("f3", "food", 3, 0.7),
                slot("f4", "food", 4, 0.6), slot("n1", "news", 5, 0.1), slot("n2", "news", 6, 0.05));
        assertThat(arrange(slots, 6)).containsExactly("f1", "f2", "n1", "f3", "f4", "n2");
    }

    @Test
    void neverThreeInARowFromOneCreator() {
        List<Slot<String>> slots = List.of(slot("a", "food", 1, 0.9), slot("b", "news", 1, 0.8), slot("c", "travel", 1, 0.7),
                slot("d", "history", 2, 0.1));
        assertThat(arrange(slots, 4)).containsExactly("a", "b", "d", "c");
    }

    @Test
    void whenOnlyOneCategoryIsLeftItFillsTheRest() {
        List<Slot<String>> slots = List.of(slot("f1", "food", 1, 0.9), slot("f2", "food", 2, 0.8), slot("f3", "food", 3, 0.7));
        assertThat(arrange(slots, 3)).containsExactly("f1", "f2", "f3");
    }

    @Test
    void aLongerRunCanBeAllowed() {
        List<Slot<String>> slots = List.of(slot("f1", "food", 1, 0.9), slot("f2", "food", 2, 0.8), slot("f3", "food", 3, 0.7),
                slot("n1", "news", 4, 0.1));
        assertThat(Diversity.arrange(slots, 4, 0, 3)).containsExactly("f1", "f2", "f3", "n1");
        assertThat(Diversity.arrange(slots, 4, 0, 1)).containsExactly("f1", "n1", "f2", "f3");
    }

    @Test
    void everySeventhSlotExploresOutsideTheUsualTopics() {
        List<Slot<String>> slots = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            slots.add(slot("in" + i, "c" + i, i, 1 - i * 0.01));
        }
        slots.add(outside("out-low", "x", 90, 0.0, 0.2));
        slots.add(outside("out-best", "y", 91, -1.0, 0.9));
        List<String> feed = Diversity.arrange(slots, 14, 7, 2);
        assertThat(feed.get(6)).isEqualTo("out-best");
        assertThat(feed.get(13)).isEqualTo("out-low");
        assertThat(feed.subList(0, 6)).containsExactly("in0", "in1", "in2", "in3", "in4", "in5");
        assertThat(feed.subList(7, 13)).containsExactly("in6", "in7", "in8", "in9", "in10", "in11");
    }

    @Test
    void withNothingOutsideTheExploreSlotTakesTheBestExploreScore() {
        List<Slot<String>> slots = List.of(new Slot<>("a", "a", 1L, 0.9, 0.1, false),
                new Slot<>("b", "b", 2L, 0.5, 0.8, false), new Slot<>("c", "c", 3L, 0.4, 0.3, false));
        assertThat(Diversity.arrange(slots, 3, 2, 2)).containsExactly("a", "b", "c");
        assertThat(Diversity.arrange(slots, 3, 1, 2)).containsExactly("b", "c", "a");
    }

    @Test
    void theExploreSlotAlsoKeepsVariety() {
        List<Slot<String>> slots = List.of(slot("f1", "food", 1, 0.9), slot("f2", "food", 2, 0.8),
                outside("f3", "food", 3, 0.1, 0.9), outside("t1", "travel", 4, 0.1, 0.5));
        assertThat(Diversity.arrange(slots, 3, 3, 2)).containsExactly("f1", "f2", "t1");
    }

    @Test
    void itemsWithoutACreatorNeverClash() {
        List<Slot<String>> slots = List.of(new Slot<>("a", "x", null, 0.9, 0.9, false),
                new Slot<>("b", "y", null, 0.8, 0.8, false), new Slot<>("c", "z", null, 0.7, 0.7, false));
        assertThat(arrange(slots, 3)).containsExactly("a", "b", "c");
    }
}
