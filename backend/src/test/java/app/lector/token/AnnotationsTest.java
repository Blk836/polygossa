package app.lector.token;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Caption annotations like "[musique]" are not words. */
class AnnotationsTest {

    private static List<Token> tokenize(Language language, String text) {
        List<RawToken> raw = language.spaceDelimited()
                ? SpaceDelimitedTokenizer.tokenize(language, text)
                : FallbackCjkTokenizer.tokenize(language, text);
        return Annotations.unmark(TokenizationService.finish(language, raw));
    }

    private static List<String> words(Language language, String text) {
        return tokenize(language, text).stream().filter(Token::word).map(Token::text).toList();
    }

    @Test
    void bracketedWordsAreNotWords() {
        assertThat(words(Language.FR, "[musique] Bonjour à tous")).containsExactly("Bonjour", "à", "tous");
    }

    @Test
    void multiWordAnnotationsAndAnnotationsMidSentence() {
        assertThat(words(Language.FR, "[Applaudissements nourris] merci")).containsExactly("merci");
        assertThat(words(Language.FR, "il a dit [sic] que")).containsExactly("il", "a", "dit", "que");
        assertThat(words(Language.FR, "un [rires] deux [musique] trois")).containsExactly("un", "deux", "trois");
    }

    @Test
    void fullWidthBracketsInCjkCaptions() {
        assertThat(words(Language.JA, "［音楽］こんにちは")).containsExactly("こんにちは");
        assertThat(words(Language.JA, "【拍手】こんにちは")).containsExactly("こんにちは");
        assertThat(words(Language.ZH, "【音乐】你好")).containsExactly("你", "好");
    }

    @Test
    void anUnclosedBracketLeavesTheWords() {
        assertThat(words(Language.FR, "[musique Bonjour à tous")).containsExactly("musique", "Bonjour", "à", "tous");
        assertThat(words(Language.FR, "fin] du texte")).containsExactly("fin", "du", "texte");
    }

    @Test
    void aBracketDoesNotRunAcrossLines() {
        assertThat(words(Language.FR, "[début\nfin]")).containsExactly("début", "fin");
        assertThat(words(Language.FR, "[début\n[musique] fin")).containsExactly("début", "fin");
    }

    @Test
    void parenthesesAreLeftAlone() {
        assertThat(words(Language.FR, "(en 1990) la ville")).containsExactly("en", "la", "ville");
    }

    @Test
    void unmarkedTokensLoseTheirLookupFieldsButKeepTheirPlace() {
        List<Token> tokens = tokenize(Language.FR, "[musique] Bonjour.");
        Token musique = tokens.get(1);
        assertThat(musique).isEqualTo(new Token(1, "musique", false, null, null, null, 0));
        assertThat(String.join("", tokens.stream().map(Token::text).toList())).isEqualTo("[musique] Bonjour.");
        assertThat(tokens.stream().map(Token::index).toList()).containsExactly(0, 1, 2, 3, 4);
    }

    @Test
    void textsWithoutAnnotationsComeBackUnchanged() {
        List<Token> plain = TokenizationService.finish(Language.ES, SpaceDelimitedTokenizer.tokenize(Language.ES, "Hola mundo."));
        assertThat(Annotations.unmark(plain)).isEqualTo(plain);
    }
}
