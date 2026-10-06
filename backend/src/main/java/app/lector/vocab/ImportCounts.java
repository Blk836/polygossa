package app.lector.vocab;

/** What an import batch did: new entries, entries it changed or left alone, and learning words over the plan limit. */
public record ImportCounts(int added, int updated, int unchanged, int overLimit) {

    public static final ImportCounts NONE = new ImportCounts(0, 0, 0, 0);

    public ImportCounts plus(ImportCounts o) {
        return new ImportCounts(added + o.added, updated + o.updated, unchanged + o.unchanged, overLimit + o.overLimit);
    }
}
