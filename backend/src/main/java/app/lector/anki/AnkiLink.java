package app.lector.anki;

import app.lector.vocab.VocabularyEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "anki_links")
public class AnkiLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id")
    private VocabularyEntry entry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "deck_id")
    private AnkiDeck deck;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private AnkiCardState state;

    private boolean promoted;

    private Long runId;

    protected AnkiLink() {}

    AnkiLink(VocabularyEntry entry, AnkiDeck deck) {
        this.userId = deck.getUserId();
        this.entry = entry;
        this.deck = deck;
    }

    void seen(AnkiCardState state, long runId, boolean promotedNow) {
        this.state = state;
        this.runId = runId;
        this.promoted = promoted || promotedNow;
    }

    boolean seenIn(long run) {
        return runId != null && runId == run;
    }

    public VocabularyEntry getEntry() { return entry; }
    public AnkiCardState getState() { return state; }
    public boolean isPromoted() { return promoted; }
}
