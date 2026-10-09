package app.lector.dictionary;

import java.util.List;

public record WordLookup(
        String term,
        String language,
        List<String> meanings,
        String meaningLanguage,
        String source) {

    public static final String COMMUNITY = "community";
    public static final String MACHINE = "machine";
}
