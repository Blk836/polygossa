package app.lector.dictionary;

import java.io.Serializable;
import java.util.List;

public record DictionaryResult(
        String term,
        String language,
        boolean found,
        String pronunciation,
        List<Sense> senses,
        String lemma,
        String source,
        String sourceUrl) implements Serializable {

    public record Sense(String partOfSpeech, String definition, List<String> examples) implements Serializable {}
}
