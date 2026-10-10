package app.lector.anki;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "anki_sync_run_words")
public class AnkiSyncRunWord {

    static final int MAX_TERM = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_id", nullable = false)
    private Long runId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AnkiOutcome outcome;

    @Column(nullable = false, length = MAX_TERM)
    private String term;

    protected AnkiSyncRunWord() {}

    AnkiSyncRunWord(Long runId, AnkiOutcome outcome, String term) {
        this.runId = runId;
        this.outcome = outcome;
        this.term = term.length() > MAX_TERM ? term.substring(0, MAX_TERM) : term;
    }
}
