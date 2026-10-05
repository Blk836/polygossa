package app.lector.token;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class TokenizationTest {

    private static List<Token> tokenize(Language language, String text) {
        List<RawToken> raw = language.spaceDelimited()
                ? SpaceDelimitedTokenizer.tokenize(language, text)
                : FallbackCjkTokenizer.tokenize(language, text);
        return TokenizationService.finish(language, raw);
    }

    private static List<String> words(List<Token> tokens) {
        return tokens.stream().filter(Token::word).map(Token::text).toList();
    }

    @Test
    void tokensReassembleToOriginalText() {
        String text = "¡Hola! ¿Qué tal?  Muy bien, gracias.\n\nAdiós…";
        List<Token> tokens = tokenize(Language.ES, text);
        assertThat(String.join("", tokens.stream().map(Token::text).toList())).isEqualTo(text);
        assertThat(words(tokens)).containsExactly("Hola", "Qué", "tal", "Muy", "bien", "gracias", "Adiós");
    }

    @Test
    void normalizesToLowerCaseAndAssignsSentences() {
        List<Token> tokens = tokenize(Language.ES, "Hola Mundo. Adiós mundo.");
        assertThat(tokens.stream().filter(Token::word).map(Token::normalized).toList())
                .containsExactly("hola", "mundo", "adiós", "mundo");
        assertThat(tokens.stream().filter(Token::word).map(Token::sentence).toList()).containsExactly(0, 0, 1, 1);
    }

    @Test
    void keepsHyphenatedAndApostropheWordsTogetherInGerman() {
        assertThat(words(tokenize(Language.DE, "Baden-Württemberg ist schön, gibt's da Kühe?")))
                .containsExactly("Baden-Württemberg", "ist", "schön", "gibt's", "da", "Kühe");
    }

    @Test
    void splitsFrenchAndItalianElisions() {
        assertThat(words(tokenize(Language.FR, "L'homme n'aime pas l’eau.")))
                .containsExactly("L'", "homme", "n'", "aime", "pas", "l’", "eau");
        assertThat(tokenize(Language.FR, "l’eau").getFirst().normalized()).isEqualTo("l'");
        assertThat(words(tokenize(Language.IT, "dell'anno"))).containsExactly("dell'", "anno");
    }

    @Test
    void fallbackSplitsChinesePerCharacter() {
        List<Token> tokens = tokenize(Language.ZH, "我喜欢猫。你呢？");
        assertThat(words(tokens)).containsExactly("我", "喜", "欢", "猫", "你", "呢");
        assertThat(tokens.getLast().sentence()).isEqualTo(1);
    }

    @Test
    void fallbackGroupsJapaneseScriptRuns() {
        assertThat(words(tokenize(Language.JA, "毎朝コーヒーを飲みます。")))
                .containsExactly("毎朝", "コーヒー", "を", "飲", "みます");
    }

    @Test
    void lemmaBecomesLookupKey() {
        List<Token> tokens = TokenizationService.finish(Language.JA,
                List.of(new RawToken("食べた", true, "食べる", "タベタ")));
        assertThat(tokens.getFirst().normalized()).isEqualTo("食べる");
        assertThat(tokens.getFirst().text()).isEqualTo("食べた");
    }
}
