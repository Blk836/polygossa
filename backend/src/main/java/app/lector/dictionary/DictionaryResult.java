package app.lector.dictionary;

import java.io.Serializable;
import java.util.List;

/** A dictionary lookup result. Serializable so it can be cached in Redis. */
public record DictionaryResult(
        String term,
        String language,
        boolean found,
        /* IPA or reading, when the source provides one */
        String pronunciation,
        List<Sense> senses,
        /* dictionary form when the looked-up word is an inflection ("casa" → "casar") */
        String lemma,
        String source,
        String sourceUrl) implements Serializable {

    public record Sense(String partOfSpeech, String definition, List<String> examples) implements Serializable {}

    public static DictionaryResult notFound(String term, String language) {
        return new DictionaryResult(term, language, false, null, List.of(), null, null, null);
    }

    public DictionaryResult withPronunciation(String value) {
        return new DictionaryResult(term, language, found, value, senses, lemma, source, sourceUrl);
    }
}
