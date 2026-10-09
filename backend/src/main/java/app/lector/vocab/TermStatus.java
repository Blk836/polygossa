package app.lector.vocab;

public final class TermStatus {

    private final String term;
    private final WordStatus status;
    private final EntryKind kind;

    public TermStatus(String term, WordStatus status, EntryKind kind) {
        this.term = term;
        this.status = status;
        this.kind = kind;
    }

    public String getTerm() { return term; }
    public WordStatus getStatus() { return status; }
    public EntryKind getKind() { return kind; }
}
