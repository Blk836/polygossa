package app.lector.anki;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

class AnkiCardTextTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "<b>Perro</b>&nbsp;|perro|Perro",
            "' perro '|perro|perro",
            "PERRO|perro|PERRO",
            "tout à fait|tout à fait|tout à fait",
            "[sound:perro.mp3]perro|perro|perro",
            "<div>el&nbsp;&nbsp;perro</div>|el perro|el perro",
            "l’homme|l'homme|l’homme"
    })
    void readsTheWordOutOfTheField(String field, String term, String display) {
        AnkiCardText.Word word = AnkiCardText.word(field, Language.ES);
        assertThat(word.skip()).isNull();
        assertThat(word.term()).isEqualTo(term);
        assertThat(word.display()).isEqualTo(display);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "&nbsp;", "<br>"})
    void anEmptyFieldIsSkippedAsEmpty(String field) {
        assertThat(AnkiCardText.word(field, Language.ES).skip()).isEqualTo(AnkiCardText.Skip.EMPTY);
    }

    @Test
    void aMissingFieldIsSkippedAsEmpty() {
        assertThat(AnkiCardText.word(null, Language.ES).skip()).isEqualTo(AnkiCardText.Skip.EMPTY);
    }

    @ParameterizedTest
    @ValueSource(strings = {"<img src=\"perro.jpg\">", "[sound:perro.mp3]", "<img src=a.png> [sound:b.mp3]&nbsp;"})
    void anImageOrSoundAloneIsSkippedAsMedia(String field) {
        assertThat(AnkiCardText.word(field, Language.ES).skip()).isEqualTo(AnkiCardText.Skip.MEDIA);
    }

    @Test
    void twelveWordsAreAPhraseButThirteenAreTooLong() {
        String twelve = "uno dos tres cuatro cinco seis siete ocho nueve diez once doce";
        assertThat(AnkiCardText.word(twelve, Language.ES).term()).isEqualTo(twelve);
        assertThat(AnkiCardText.word(twelve + " trece", Language.ES).skip()).isEqualTo(AnkiCardText.Skip.TOO_LONG);
    }

    @Test
    void aVeryLongWordWithoutSpacesIsTooLong() {
        assertThat(AnkiCardText.word("猫".repeat(101), Language.JA).skip()).isEqualTo(AnkiCardText.Skip.TOO_LONG);
        assertThat(AnkiCardText.word("猫".repeat(100), Language.JA).skip()).isNull();
    }

    @Test
    void theMeaningIsPlainTextWithoutSounds() {
        assertThat(AnkiCardText.meaning("<i>dog</i>[sound:dog.mp3]<br>hound")).isEqualTo("dog hound");
        assertThat(AnkiCardText.meaning("  ")).isNull();
        assertThat(AnkiCardText.meaning(null)).isNull();
        assertThat(AnkiCardText.meaning("x".repeat(3000))).hasSize(2000);
    }
}
