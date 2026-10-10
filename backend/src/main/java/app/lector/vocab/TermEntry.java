package app.lector.vocab;

public record TermEntry(String term, WordStatus status, EntryKind kind, String meaning) {}
