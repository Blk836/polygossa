package app.lector.dictionary;

import java.util.Optional;
import java.util.Set;
import tools.jackson.databind.JsonNode;

public record WordType(String partOfSpeech, String form, String lemma) {

    static final int LONGEST_PART = 40;

    private static final Set<String> KINDS = Set.of("noun", "verb", "adjective", "adverb", "pronoun", "preposition",
            "conjunction", "determiner", "interjection", "number", "phrase");

    static Optional<WordType> from(JsonNode answer, String word) {
        String kind = text(answer.path("partOfSpeech"));
        if (kind == null || !KINDS.contains(kind.toLowerCase())) {
            return Optional.empty();
        }
        String lemma = text(answer.path("lemma"));
        return Optional.of(new WordType(kind.toLowerCase(), text(answer.path("form")),
                lemma == null || lemma.equalsIgnoreCase(word) ? null : lemma));
    }

    private static String text(JsonNode node) {
        if (!node.isString()) {
            return null;
        }
        String s = node.asString().strip();
        return s.isEmpty() || s.length() > LONGEST_PART ? null : s;
    }
}
