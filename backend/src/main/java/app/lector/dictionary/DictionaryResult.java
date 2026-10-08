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
        String sourceUrl,
        /* the word in the learner's native language (empty when none was found); null for English speakers */
        List<String> translations,
        String translationLanguage,
        /* where the translations came from: community, dictionary or machine (null when there are none) */
        String translationSource) implements Serializable {

    public static final String COMMUNITY = "community";
    public static final String DICTIONARY = "dictionary";
    public static final String MACHINE = "machine";

    public record Sense(String partOfSpeech, String definition, List<String> examples) implements Serializable {}

    /** A result without native-language translations. */
    public DictionaryResult(String term, String language, boolean found, String pronunciation, List<Sense> senses,
                            String lemma, String source, String sourceUrl) {
        this(term, language, found, pronunciation, senses, lemma, source, sourceUrl, null, null, null);
    }

    public static DictionaryResult notFound(String term, String language) {
        return new DictionaryResult(term, language, false, null, List.of(), null, null, null);
    }

    public DictionaryResult withPronunciation(String value) {
        return new DictionaryResult(term, language, found, value, senses, lemma, source, sourceUrl, translations,
                translationLanguage, translationSource);
    }

    /** The result with translations from the dictionaries (an empty list says none were found). */
    public DictionaryResult withTranslations(String nativeLanguage, List<String> words) {
        return withTranslations(nativeLanguage, words, words.isEmpty() ? null : DICTIONARY);
    }

    public DictionaryResult withTranslations(String nativeLanguage, List<String> words, String from) {
        return new DictionaryResult(term, language, found, pronunciation, senses, lemma, source, sourceUrl,
                List.copyOf(words), nativeLanguage, from);
    }
}
