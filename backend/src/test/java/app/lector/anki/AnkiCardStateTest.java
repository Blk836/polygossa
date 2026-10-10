package app.lector.anki;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AnkiCardStateTest {

    @ParameterizedTest
    @CsvSource({
            "0, 0, NEW",
            "1, -600, YOUNG",
            "2, 1, YOUNG",
            "2, 20, YOUNG",
            "2, 21, MATURE",
            "2, 400, MATURE",
            "3, -600, YOUNG",
            "3, 30, YOUNG"
    })
    void readsAnkisCardTypeAndInterval(int type, int interval, AnkiCardState state) {
        assertThat(AnkiCardState.of(type, interval)).isEqualTo(state);
    }

    @ParameterizedTest
    @CsvSource({"NEW, YOUNG, YOUNG", "MATURE, YOUNG, MATURE", "YOUNG, YOUNG, YOUNG", "NEW, MATURE, MATURE"})
    void theMostAdvancedCardWins(AnkiCardState a, AnkiCardState b, AnkiCardState best) {
        assertThat(AnkiCardState.best(a, b)).isEqualTo(best);
        assertThat(AnkiCardState.best(b, a)).isEqualTo(best);
    }
}
