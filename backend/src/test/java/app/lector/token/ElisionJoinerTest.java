package app.lector.token;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ElisionJoinerTest {

    private static List<Token> legacy(String... parts) {
        List<Token> tokens = new ArrayList<>();
        for (String part : parts) {
            boolean word = Character.isLetter(part.charAt(0));
            tokens.add(new Token(tokens.size(), part, word, word ? part.toLowerCase() : null, null, null,
                    part.equals(".") ? 0 : tokens.isEmpty() ? 0 : tokens.getLast().sentence()));
        }
        return tokens;
    }

    @Test
    void joinsAnElisionWithTheWordAfterIt() {
        ElisionJoiner.Joined joined = ElisionJoiner.join(Language.FR,
                legacy("C'", "est", " ", "l’", "homme", " ", "d'", "aujourd'", "hui", "."));
        assertThat(joined.tokens()).extracting(Token::text)
                .containsExactly("C'est", " ", "l’homme", " ", "d'aujourd'hui", ".");
        assertThat(joined.tokens()).extracting(Token::normalized)
                .containsExactly("c'est", null, "l'homme", null, "d'aujourd'hui", null);
        assertThat(joined.tokens()).extracting(Token::index).containsExactly(0, 1, 2, 3, 4, 5);
        assertThat(joined.newIndex()).containsExactly(0, 0, 1, 2, 2, 3, 4, 4, 4, 5);
        assertThat(joined.changed()).isTrue();
    }

    @Test
    void leavesTokensWithoutSplitElisionsAlone() {
        List<Token> tokens = legacy("l'homme", " ", "aime", ".");
        ElisionJoiner.Joined joined = ElisionJoiner.join(Language.FR, tokens);
        assertThat(joined.changed()).isFalse();
        assertThat(joined.tokens()).isEqualTo(tokens);
    }

    @Test
    void anApostropheBeforeSpaceOrPunctuationIsNotJoined() {
        ElisionJoiner.Joined joined = ElisionJoiner.join(Language.FR, legacy("l'", " ", "eau", "."));
        assertThat(joined.changed()).isFalse();
    }
}
