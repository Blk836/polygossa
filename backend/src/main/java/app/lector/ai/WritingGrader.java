package app.lector.ai;

import app.lector.token.Language;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** AI marking of a timed writing test against its situation, on a fixed four-part rubric. */
@Service
public class WritingGrader {

    public static final List<String> CRITERIA = List.of("task", "grammar", "vocabulary", "coherence");

    /** One rubric line, scored 1–5. */
    public record RubricScore(String criterion, int score, String comment) {}

    public record Correction(String original, String corrected, String explanation) {}

    /** Overall score 0–100, an estimated CEFR level, the rubric, corrections and a corrected version. */
    public record Grade(int score, String level, List<RubricScore> rubric, List<Correction> corrections,
                        String correctedText, String summary) {

        public Grade withScore(int newScore) {
            return new Grade(newScore, level, rubric, corrections, correctedText, summary);
        }
    }

    /** What the learner was asked and what they wrote. */
    public record Submission(Language language, String level, String situation, int minimum, String unit, int count,
                             String content) {}

    private final AiClient ai;

    public WritingGrader(AiClient ai) {
        this.ai = ai;
    }

    public Grade grade(Submission s) {
        String lang = s.language().displayName();
        JsonNode r = ai.completeJson(
                "You are a strict but fair examiner marking a timed " + lang + " writing test (5 minutes) for a learner "
                        + "aiming at CEFR " + s.level() + ". Mark only what was written. Score each criterion 1-5: "
                        + "task (did it address every point of the situation, in " + lang + "?), grammar, vocabulary "
                        + "(range and accuracy), coherence (organisation and linking). The minimum length was "
                        + s.minimum() + " " + s.unit() + "; shorter answers cannot get more than 2 for task. "
                        + "Comments and explanations in English, one short sentence each. Reply with JSON: "
                        + "{\"score\": 0-100, \"level\": CEFR level the writing shows, \"rubric\": {\"task\": {\"score\": "
                        + "1-5, \"comment\": string}, \"grammar\": {...}, \"vocabulary\": {...}, \"coherence\": {...}}, "
                        + "\"corrections\": [{\"original\": string, \"corrected\": string, \"explanation\": string}] "
                        + "(at most 8, most important first), \"correctedText\": string, \"summary\": string "
                        + "(2-3 sentences: main strength, main thing to work on)}.",
                "Situation: " + s.situation() + "\nLength: " + s.count() + " " + s.unit() + " (minimum " + s.minimum()
                        + ")\n\nAnswer:\n" + s.content());
        return parse(r, s.content());
    }

    /** Reads the model's verdict defensively: scores clamped, every rubric line present. */
    static Grade parse(JsonNode r, String original) {
        List<RubricScore> rubric = new ArrayList<>();
        int sum = 0;
        for (String c : CRITERIA) {
            JsonNode node = r.path("rubric").path(c);
            int score = clamp(node.path("score").asInt(1), 1, 5);
            sum += score;
            rubric.add(new RubricScore(c, score, node.path("comment").asString("")));
        }
        int fromRubric = Math.round(sum * 100f / (5 * CRITERIA.size()));
        int score = r.path("score").isNumber() ? clamp(r.path("score").asInt(), 0, 100) : fromRubric;
        List<Correction> corrections = new ArrayList<>();
        for (JsonNode c : r.path("corrections")) {
            corrections.add(new Correction(c.path("original").asString(""), c.path("corrected").asString(""),
                    c.path("explanation").asString("")));
        }
        return new Grade(score, r.path("level").asString(null), rubric, corrections,
                r.path("correctedText").asString(original), r.path("summary").asString(""));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
