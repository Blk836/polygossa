package app.lector.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ai.WritingGrader.Grade;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Turning the AI's JSON verdict into a grade the app can trust (scores always in range, rubric always complete). */
class WritingGraderTest {

    private static JsonNode json(String s) {
        return JsonMapper.builder().build().readTree(s);
    }

    @Test
    void readsAFullVerdict() {
        Grade g = WritingGrader.parse(json("""
                {"score": 72, "level": "B1",
                 "rubric": {"task": {"score": 4, "comment": "Covers all points"},
                            "grammar": {"score": 3, "comment": "Some agreement errors"},
                            "vocabulary": {"score": 4, "comment": "Good range"},
                            "coherence": {"score": 3, "comment": "Needs linking words"}},
                 "corrections": [{"original": "je suis allé", "corrected": "je suis allée", "explanation": "Agreement"}],
                 "correctedText": "Fixed.", "summary": "Solid work."}
                """), "orig");
        assertThat(g.score()).isEqualTo(72);
        assertThat(g.level()).isEqualTo("B1");
        assertThat(g.rubric()).extracting(WritingGrader.RubricScore::criterion)
                .containsExactly("task", "grammar", "vocabulary", "coherence");
        assertThat(g.rubric()).extracting(WritingGrader.RubricScore::score).containsExactly(4, 3, 4, 3);
        assertThat(g.rubric().get(1).comment()).isEqualTo("Some agreement errors");
        assertThat(g.corrections()).hasSize(1);
        assertThat(g.corrections().getFirst().corrected()).isEqualTo("je suis allée");
        assertThat(g.correctedText()).isEqualTo("Fixed.");
        assertThat(g.summary()).isEqualTo("Solid work.");
    }

    @Test
    void clampsOutOfRangeScores() {
        Grade g = WritingGrader.parse(json("""
                {"score": 140, "rubric": {"task": {"score": 9}, "grammar": {"score": -2},
                 "vocabulary": {"score": 0}, "coherence": {"score": 5}}}
                """), "orig");
        assertThat(g.score()).isEqualTo(100);
        assertThat(g.rubric()).extracting(WritingGrader.RubricScore::score).containsExactly(5, 1, 1, 5);
        assertThat(WritingGrader.parse(json("{\"score\": -5}"), "o").score()).isZero();
    }

    @Test
    void fillsGapsWhenTheVerdictIsIncomplete() {
        Grade g = WritingGrader.parse(json("{}"), "my text");
        assertThat(g.rubric()).extracting(WritingGrader.RubricScore::score).containsExactly(1, 1, 1, 1);
        assertThat(g.rubric()).allSatisfy(r -> assertThat(r.comment()).isEmpty());
        assertThat(g.score()).isEqualTo(20); // from the rubric average when no overall score is given
        assertThat(g.correctedText()).isEqualTo("my text");
        assertThat(g.corrections()).isEmpty();
        assertThat(g.level()).isNull();
        assertThat(g.summary()).isEmpty();
    }

    @Test
    void derivesTheOverallScoreFromTheRubricWhenMissing() {
        Grade g = WritingGrader.parse(json("""
                {"rubric": {"task": {"score": 5}, "grammar": {"score": 4}, "vocabulary": {"score": 4}, "coherence": {"score": 3}}}
                """), "o");
        assertThat(g.score()).isEqualTo(80);
    }

    @Test
    void cappingKeepsEverythingButTheScore() {
        Grade g = WritingGrader.parse(json("{\"score\": 90, \"summary\": \"Nice\"}"), "o");
        Grade capped = g.withScore(45);
        assertThat(capped.score()).isEqualTo(45);
        assertThat(capped.summary()).isEqualTo("Nice");
        assertThat(capped.rubric()).isEqualTo(g.rubric());
    }
}
