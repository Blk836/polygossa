package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Token;
import java.util.List;
import org.junit.jupiter.api.Test;

class PersonNamesTest {

    private static Token word(int index, String text) {
        return new Token(index, text, true, text, null, null, 0);
    }

    @Test
    void languagesWithoutCapitalLettersHaveNoWordsToCheck() {
        List<Token> japanese = List.of(word(0, "田中"), word(1, "さん"), word(2, "東京"));
        List<Token> korean = List.of(word(0, "민수는"), word(1, "서울에"), word(2, "살아요"));
        List<Token> chinese = List.of(word(0, "王小明"), word(1, "住在"), word(2, "北京"));
        assertThat(PersonNames.candidates(japanese)).isEmpty();
        assertThat(PersonNames.candidates(korean)).isEmpty();
        assertThat(PersonNames.candidates(chinese)).isEmpty();
    }
}
