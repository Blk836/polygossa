package app.lector.vocab;

/** What an import batch did: new entries, entries it changed or left alone, and learning words over the plan limit. */
public record ImportCounts(int added, int updated, int unchanged, int overLimit) {}
