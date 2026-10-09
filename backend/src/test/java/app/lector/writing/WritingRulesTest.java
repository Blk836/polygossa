package app.lector.writing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.token.Language;
import java.time.Duration;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class WritingRulesTest {

    @Test
    void fiveMinutesWithAShortGraceForTheNetwork() {
        assertThat(WritingRules.TIME_LIMIT).isEqualTo(Duration.ofMinutes(5));
        assertThat(WritingRules.GRACE).isEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void minimumGrowsWithLevel() {
        assertThat(List.of("A1", "A2", "B1", "B2", "C1", "C2").stream()
                .map(l -> WritingRules.minimum(l, Language.FR)).toList())
                .containsExactly(25, 40, 60, 80, 100, 120);
    }

    @Test
    void japaneseAndChineseCountCharactersAndNeedTwiceAsMany() {
        assertThat(WritingRules.unit(Language.JA)).isEqualTo("characters");
        assertThat(WritingRules.unit(Language.ZH)).isEqualTo("characters");
        assertThat(WritingRules.unit(Language.KO)).isEqualTo("words");
        assertThat(WritingRules.unit(Language.ES)).isEqualTo("words");
        assertThat(WritingRules.minimum("B1", Language.JA)).isEqualTo(120);
        assertThat(WritingRules.minimum("B1", Language.KO)).isEqualTo(60);
    }

    @Test
    void unknownLevelIsRejected() {
        assertThatThrownBy(() -> WritingRules.minimum("D1", Language.FR)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> WritingRules.minimum(null, Language.FR)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void countsWordsAsRunsOfLettersAndDigits() {
        assertThat(WritingRules.count("Je suis allé au marché, puis j'ai mangé.", Language.FR)).isEqualTo(9);
        assertThat(WritingRules.count("  Hola   mundo  \n 2026 ", Language.ES)).isEqualTo(3);
        assertThat(WritingRules.count("안녕하세요. 저는 학생이에요!", Language.KO)).isEqualTo(3);
        assertThat(WritingRules.count("— ... !!", Language.FR)).isZero();
        assertThat(WritingRules.count("", Language.FR)).isZero();
        assertThat(WritingRules.count(null, Language.FR)).isZero();
    }

    @Test
    void countsCjkCharactersIgnoringSpacesAndPunctuation() {
        assertThat(WritingRules.count("今日は、いい天気です。", Language.JA)).isEqualTo(9);
        assertThat(WritingRules.count("我 喜欢 咖啡！", Language.ZH)).isEqualTo(5);
    }

    @Test
    void shortWritingCapsTheScoreInProportion() {
        assertThat(WritingRules.capForLength(90, 30, 60)).isEqualTo(50);
        assertThat(WritingRules.capForLength(40, 30, 60)).isEqualTo(40);
        assertThat(WritingRules.capForLength(90, 60, 60)).isEqualTo(90);
        assertThat(WritingRules.capForLength(90, 200, 60)).isEqualTo(90);
        assertThat(WritingRules.capForLength(90, 0, 60)).isZero();
    }

    @Test
    void promptBankHasSeveralPromptsForEveryLevel() {
        for (String level : List.of("A1", "A2", "B1", "B2", "C1", "C2")) {
            assertThat(PromptBank.load().forLevel(level)).hasSizeGreaterThanOrEqualTo(5);
        }
        assertThat(PromptBank.load().forLevel("B1")).allSatisfy(p -> {
            assertThat(p.id()).startsWith("B1-");
            assertThat(p.situation()).hasSizeGreaterThan(30);
        });
    }

    @Test
    void picksAPromptTheLearnerHasNotHadRecently() {
        PromptBank bank = PromptBank.load();
        List<PromptBank.Prompt> b1 = bank.forLevel("B1");
        Set<String> recent = Set.copyOf(b1.subList(0, b1.size() - 1).stream().map(PromptBank.Prompt::id).toList());
        for (int seed = 0; seed < 20; seed++) {
            assertThat(bank.pick("B1", recent, new Random(seed))).isEqualTo(b1.getLast());
        }
    }

    @Test
    void reusesPromptsOnceAllHaveBeenSeen() {
        PromptBank bank = PromptBank.load();
        Set<String> all = Set.copyOf(bank.forLevel("A1").stream().map(PromptBank.Prompt::id).toList());
        assertThat(bank.pick("A1", all, new Random(1)).id()).startsWith("A1-");
    }
}
