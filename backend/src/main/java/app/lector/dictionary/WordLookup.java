package app.lector.dictionary;

import java.util.List;

public record WordLookup(
        String term,
        String language,
        List<String> meanings,
        String meaningLanguage,
        String source,
        WordType wordType) {

    public static final String COMMUNITY = "community";
    public static final String MACHINE = "machine";
    public static final String SENTENCE = "sentence";

    public WordLookup(String term, String language, List<String> meanings, String meaningLanguage, String source) {
        this(term, language, meanings, meaningLanguage, source, null);
    }
}
