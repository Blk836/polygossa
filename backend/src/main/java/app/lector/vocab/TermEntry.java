package app.lector.vocab;

/** A saved word's key, status, kind and own-language meaning: what the vocabulary map needs of each entry. */
public record TermEntry(String term, WordStatus status, EntryKind kind, String meaning) {}
