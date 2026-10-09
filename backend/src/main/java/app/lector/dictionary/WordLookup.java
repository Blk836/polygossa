package app.lector.dictionary;

import java.util.List;

/**
 * What the word popup shows for a word or phrase (lingq-style-lookup.feature): its meanings in the learner's own
 * language, most useful first, and where they came from.
 */
public record WordLookup(
        /* the word's normalized key, as saved words keep it */
        String term,
        String language,
        /* empty when there is none to show yet */
        List<String> meanings,
        /* the learner's native language; null when they are reading it (nothing to translate) */
        String meaningLanguage,
        /* community (other learners' saved meanings) or machine; null when there are no meanings */
        String source) {

    public static final String COMMUNITY = "community";
    public static final String MACHINE = "machine";
}
