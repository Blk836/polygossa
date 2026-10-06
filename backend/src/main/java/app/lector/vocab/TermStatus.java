package app.lector.vocab;

/**
 * One vocabulary entry's term and status, as reader pages and card stats read them for every word a learner has.
 * A plain row built by the query: an interface projection made a proxy per row (and worked out its interceptors on
 * every getter call), which was a large share of the backend's CPU for learners with thousands of words.
 */
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
