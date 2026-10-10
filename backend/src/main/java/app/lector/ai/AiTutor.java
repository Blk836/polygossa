package app.lector.ai;

import app.lector.dictionary.DictionaryResult;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AiTutor {

    public record Example(String sentence, String translation) {}

    public record Correction(String original, String corrected, String explanation) {}

    public record Feedback(String correctedText, List<Correction> corrections, String overallComment, String level) {}

    private final AiClient ai;

    public AiTutor(AiClient ai) {
        this.ai = ai;
    }

    public boolean enabled() {
        return ai.enabled();
    }

    public DictionaryResult define(Language language, NativeLanguage learner, String term, String context) {
        JsonNode r = ai.completeJson(
                "You are a bilingual dictionary for " + learner.displayName() + "-speaking learners of "
                        + language.displayName()
                        + ". Reply with JSON: {\"lemma\": string|null, \"pronunciation\": string (IPA or reading), "
                        + "\"senses\": [{\"partOfSpeech\": string, \"definition\": string (" + learner.displayName()
                        + "), "
                        + "\"examples\": [string in " + language.displayName() + "]}]}. At most 3 senses; "
                        + "put the sense that fits the context first.",
                "Word: " + term + (context == null || context.isBlank() ? "" : "\nContext: " + context));
        List<DictionaryResult.Sense> senses = new ArrayList<>();
        for (JsonNode s : r.path("senses")) {
            List<String> examples = new ArrayList<>();
            for (JsonNode e : s.path("examples")) {
                examples.add(e.asString(""));
            }
            senses.add(new DictionaryResult.Sense(s.path("partOfSpeech").asString(""),
                    s.path("definition").asString(""), examples));
        }
        String lemma = r.path("lemma").isNull() ? null : r.path("lemma").asString(null);
        return new DictionaryResult(term, language.code(), !senses.isEmpty(), r.path("pronunciation").asString(null),
                senses, lemma != null && lemma.equalsIgnoreCase(term) ? null : lemma, "AI", null);
    }

    public Example example(Language language, NativeLanguage learner, String term, String definition) {
        JsonNode r = ai.completeJson(
                "You write short, natural example sentences for language learners. Reply with JSON: "
                        + "{\"sentence\": string in " + language.displayName() + ", \"translation\": string in "
                        + learner.displayName() + "}. "
                        + "Keep the sentence under 15 words and at roughly B1 level.",
                "Word: " + term + (definition == null ? "" : "\nMeaning: " + definition));
        return new Example(r.path("sentence").asString(""), r.path("translation").asString(""));
    }

    public String translate(Language language, NativeLanguage learner, String text) {
        JsonNode r = ai.completeJson(
                "Translate the " + language.displayName() + " text into natural " + learner.displayName() + ". "
                        + "Reply with JSON: {\"translation\": string}.",
                text);
        return r.path("translation").asString("");
    }

    public Feedback writingFeedback(Language language, NativeLanguage learner, String sourceExcerpt, String writing) {
        JsonNode r = ai.completeJson(
                "You are a supportive " + language.displayName() + " writing tutor. The student read a text and wrote "
                        + "a short response in " + language.displayName() + ". Correct grammar, spelling, word choice and "
                        + "unnatural phrasing. Explanations must be in " + learner.displayName()
                        + " and brief. Reply with JSON: "
                        + "{\"correctedText\": string, \"corrections\": [{\"original\": string, \"corrected\": string, "
                        + "\"explanation\": string}], \"overallComment\": string (encouraging, 1-3 sentences), "
                        + "\"level\": CEFR level estimate of the writing}.",
                (sourceExcerpt == null ? "" : "Text the student read (excerpt):\n" + sourceExcerpt + "\n\n")
                        + "Student's response:\n" + writing);
        List<Correction> corrections = new ArrayList<>();
        for (JsonNode c : r.path("corrections")) {
            corrections.add(new Correction(c.path("original").asString(""), c.path("corrected").asString(""),
                    c.path("explanation").asString("")));
        }
        return new Feedback(r.path("correctedText").asString(writing), corrections,
                r.path("overallComment").asString(""), r.path("level").asString(null));
    }
}
