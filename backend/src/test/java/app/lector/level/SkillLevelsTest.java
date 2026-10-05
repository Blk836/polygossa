package app.lector.level;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.level.SkillLevels.Confidence;
import app.lector.level.SkillLevels.Overall;
import app.lector.level.SkillLevels.Skill;
import app.lector.token.Language;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Feature: Reading, Listening and Writing levels from the learner's evidence (docs/acceptance/skill-levels.feature). */
class SkillLevelsTest {

    private static final Map<String, Integer> NONE = Map.of();

    // ---- Reading ----

    @ParameterizedTest
    @CsvSource({
            "0, ", "49, ", "50, A1", "1199, A1", "1200, A2", "2499, A2", "2500, B1", "4999, B1", "5000, B2",
            "8999, B2", "9000, C1", "14999, C1", "15000, C2", "100000, C2"})
    void readingFromKnownWordsInEuropeanLanguages(long known, String level) {
        assertThat(SkillLevels.reading(Language.ES, known, NONE).level()).isEqualTo(level);
    }

    @ParameterizedTest
    @CsvSource({"49, ", "50, A1", "399, A1", "400, A2", "999, A2", "1000, B1", "1999, B1", "2000, B2", "3999, B2",
            "4000, C1", "6999, C1", "7000, C2"})
    void chineseAndJapaneseHaveTheirOwnThresholds(long known, String level) {
        assertThat(SkillLevels.reading(Language.JA, known, NONE).level()).isEqualTo(level);
        assertThat(SkillLevels.reading(Language.ZH, known, NONE).level()).isEqualTo(level);
    }

    @Test
    void koreanUsesTheEuropeanTable() {
        assertThat(SkillLevels.reading(Language.KO, 1200, NONE).level()).isEqualTo("A2");
        assertThat(SkillLevels.reading(Language.JA, 1200, NONE).level()).isEqualTo("B1");
    }

    @Test
    void finishingHarderTextsRaisesReadingByAtMostOneLevel() {
        assertThat(SkillLevels.reading(Language.ES, 1300, Map.of("B2", 3)).level()).isEqualTo("B1");
        assertThat(SkillLevels.reading(Language.ES, 1300, Map.of("C2", 10)).level()).isEqualTo("B1");
    }

    @Test
    void finishedTextsCountAtTheirLevelAndBelow() {
        // 1 B1 + 2 B2 = 3 texts at B1 or harder
        assertThat(SkillLevels.reading(Language.ES, 600, Map.of("B1", 1, "B2", 2)).level()).isEqualTo("A2");
    }

    @Test
    void fewerThanThreeFinishedTextsDoNotRaiseReading() {
        assertThat(SkillLevels.reading(Language.ES, 1300, Map.of("B1", 2)).level()).isEqualTo("A2");
    }

    @Test
    void easierFinishedTextsNeverLowerReading() {
        assertThat(SkillLevels.reading(Language.ES, 5000, Map.of("A1", 20)).level()).isEqualTo("B2");
    }

    @Test
    void readingAtTheTopCannotGoHigher() {
        assertThat(SkillLevels.reading(Language.ES, 20000, Map.of("C2", 5)).level()).isEqualTo("C2");
    }

    @Test
    void finishedTextsAloneAreNotEnoughForReading() {
        Skill r = SkillLevels.reading(Language.ES, 10, Map.of("B1", 5));
        assertThat(r.level()).isNull();
        assertThat(r.confidence()).isNull();
        assertThat(r.evidence()).isEqualTo(5);
    }

    @ParameterizedTest
    @CsvSource({"1300, 0, LOW", "1300, 2, LOW", "1300, 3, MEDIUM", "1300, 9, MEDIUM", "1300, 10, HIGH",
            "2499, 0, LOW", "2500, 0, HIGH"})
    void readingConfidence(long known, int finished, Confidence confidence) {
        Skill r = SkillLevels.reading(Language.ES, known, finished == 0 ? NONE : Map.of("A1", finished));
        assertThat(r.confidence()).isEqualTo(confidence);
        assertThat(r.evidence()).isEqualTo(finished);
    }

    // ---- Listening ----

    @Test
    void noListeningIsNotEnoughData() {
        Skill l = SkillLevels.listening(Language.ES, 3000, NONE);
        assertThat(l.level()).isNull();
        assertThat(l.confidence()).isNull();
        assertThat(l.evidence()).isZero();
    }

    @Test
    void listeningFromFinishedVideosAndAudio() {
        assertThat(SkillLevels.listening(Language.ES, 3000, Map.of("A2", 3, "B1", 3)).level()).isEqualTo("B1");
    }

    @Test
    void listeningCannotExceedVocabularyByMoreThanOneLevel() {
        assertThat(SkillLevels.listening(Language.ES, 600, Map.of("C1", 4)).level()).isEqualTo("A2");
    }

    @Test
    void listeningWithLittleVocabularyStaysAtA1() {
        assertThat(SkillLevels.listening(Language.ES, 0, Map.of("B2", 4)).level()).isEqualTo("A1");
    }

    @Test
    void withFewerThanThreeItemsListeningIsTheEasiestOneFinished() {
        assertThat(SkillLevels.listening(Language.ES, 20000, Map.of("B2", 1)).level()).isEqualTo("B2");
        assertThat(SkillLevels.listening(Language.ES, 20000, Map.of("B2", 1, "C1", 1)).level()).isEqualTo("B2");
    }

    @Test
    void listeningIsTheHighestLevelWithThreeItemsAtOrAboveIt() {
        assertThat(SkillLevels.listening(Language.ES, 20000, Map.of("A1", 5, "C1", 2)).level()).isEqualTo("A1");
        assertThat(SkillLevels.listening(Language.ES, 20000, Map.of("A1", 5, "B2", 1, "C1", 2)).level())
                .isEqualTo("B2");
    }

    @ParameterizedTest
    @CsvSource({"1, LOW", "2, LOW", "3, MEDIUM", "9, MEDIUM", "10, HIGH"})
    void listeningConfidence(int finished, Confidence confidence) {
        Skill l = SkillLevels.listening(Language.ES, 20000, Map.of("A1", finished));
        assertThat(l.confidence()).isEqualTo(confidence);
        assertThat(l.evidence()).isEqualTo(finished);
    }

    // ---- Writing ----

    @Test
    void noGradedTestsIsNotEnoughData() {
        Skill w = SkillLevels.writing(List.of());
        assertThat(w.level()).isNull();
        assertThat(w.confidence()).isNull();
        assertThat(w.evidence()).isZero();
    }

    @Test
    void writingIsTheRecencyWeightedMiddleOfTheLastFiveGrades() {
        assertThat(SkillLevels.writing(List.of("A2", "B1", "B1", "B2", "B1")).level()).isEqualTo("B1");
    }

    @Test
    void recentGradesWeighMore() {
        // newest first, weights 5,4,3,2,1: C1 has 5+4 = 9 of 15
        assertThat(SkillLevels.writing(List.of("C1", "C1", "A1", "A1", "A1")).level()).isEqualTo("C1");
        // A1 has 3+2+1 = 6 of 15, under half
        assertThat(SkillLevels.writing(List.of("A2", "A2", "A1", "A1", "A1")).level()).isEqualTo("A2");
        // exactly half goes to the lower level
        assertThat(SkillLevels.writing(List.of("A1", "B2")).level()).isEqualTo("A1");
        assertThat(SkillLevels.writing(List.of("B2", "A1")).level()).isEqualTo("B2");
    }

    @Test
    void onlyTheLastFiveGradesCount() {
        List<String> grades = new java.util.ArrayList<>(List.of("B2", "B2", "B2", "B2", "B2"));
        grades.addAll(Arrays.asList("A1", "A1", "A1", "A1", "A1", "A1", "A1", "A1", "A1", "A1"));
        Skill w = SkillLevels.writing(grades);
        assertThat(w.level()).isEqualTo("B2");
        assertThat(w.evidence()).isEqualTo(5);
    }

    @Test
    void unknownLevelsAreSkipped() {
        Skill w = SkillLevels.writing(Arrays.asList(null, "B1", "Z9", "B1"));
        assertThat(w.level()).isEqualTo("B1");
        assertThat(w.evidence()).isEqualTo(2);
    }

    @ParameterizedTest
    @CsvSource({"1, LOW", "2, LOW", "3, MEDIUM", "4, MEDIUM", "5, HIGH", "8, HIGH"})
    void writingConfidence(int tests, Confidence confidence) {
        assertThat(SkillLevels.writing(java.util.Collections.nCopies(tests, "B1")).confidence()).isEqualTo(confidence);
    }

    // ---- Overall ----

    private static Skill at(String level) {
        return new Skill(level, Confidence.LOW, 1);
    }

    private static final Skill NO_DATA = new Skill(null, null, 0);

    @Test
    void overallIsTheAverageRoundedDown() {
        Overall o = SkillLevels.overall(at("B2"), at("B1"), at("A2"));
        assertThat(o.level()).isEqualTo("B1");
        assertThat(o.basedOn()).containsExactly("reading", "listening", "writing");
        assertThat(SkillLevels.overall(at("B2"), at("B1"), NO_DATA).level()).isEqualTo("B1");
        assertThat(SkillLevels.overall(at("C2"), at("C2"), at("C1")).level()).isEqualTo("C1");
        assertThat(SkillLevels.overall(at("C2"), at("C2"), at("C2")).level()).isEqualTo("C2");
    }

    @Test
    void overallUsesOnlySkillsWithData() {
        Overall o = SkillLevels.overall(at("B1"), NO_DATA, NO_DATA);
        assertThat(o.level()).isEqualTo("B1");
        assertThat(o.basedOn()).containsExactly("reading");
        assertThat(SkillLevels.overall(NO_DATA, NO_DATA, at("A2")).basedOn()).containsExactly("writing");
        assertThat(SkillLevels.overall(NO_DATA, at("A2"), NO_DATA).basedOn()).containsExactly("listening");
    }

    @Test
    void noOverallWithoutAnyData() {
        assertThat(SkillLevels.overall(NO_DATA, NO_DATA, NO_DATA)).isNull();
    }

    @Test
    void confidenceIsLowerCaseInJson() {
        assertThat(Confidence.MEDIUM.code()).isEqualTo("medium");
    }
}
