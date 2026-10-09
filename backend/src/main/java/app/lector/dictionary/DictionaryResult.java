package app.lector.dictionary;

import java.io.Serializable;
import java.util.List;

/** The AI's explanation of a word (Pro, on demand): definitions in the learner's language, with examples. */
public record DictionaryResult(
        String term,
        String language,
        boolean found,
        /* IPA or reading, when the AI gives one */
        String pronunciation,
        List<Sense> senses,
        /* dictionary form when the looked-up word is an inflection ("casa" → "casar") */
        String lemma,
        String source,
        String sourceUrl) implements Serializable {

    public record Sense(String partOfSpeech, String definition, List<String> examples) implements Serializable {}
}
