package app.lector.vocab;

/** A word brought in from another app (LingQ, Readlang); {@code definition} and {@code context} may be null. */
public record ImportedWord(String term, WordStatus status, String definition, String context) {}
