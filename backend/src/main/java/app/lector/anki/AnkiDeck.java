package app.lector.anki;

import app.lector.token.Language;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "anki_decks")
public class AnkiDeck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private long ankiDeckId;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Column(nullable = false, length = 100)
    private String wordField;

    @Column(length = 100)
    private String meaningField;

    private Instant firstSyncedAt;

    @ElementCollection
    @CollectionTable(name = "anki_note_types", joinColumns = @JoinColumn(name = "deck_id"))
    @OrderColumn(name = "position")
    private List<AnkiNoteType> noteTypes = new ArrayList<>();

    protected AnkiDeck() {}

    void noteTypes(List<AnkiNoteType> chosen) {
        noteTypes.clear();
        noteTypes.addAll(chosen);
    }

    public List<AnkiNoteType> getNoteTypes() { return noteTypes; }

    AnkiDeck(Long userId, long ankiDeckId) {
        this.userId = userId;
        this.ankiDeckId = ankiDeckId;
    }

    void choose(String name, Language language, String wordField, String meaningField) {
        this.name = name;
        this.language = language;
        this.wordField = wordField;
        this.meaningField = meaningField;
    }

    void synced(Instant at) {
        if (firstSyncedAt == null) {
            firstSyncedAt = at;
        }
    }

    boolean neverSynced() {
        return firstSyncedAt == null;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public long getAnkiDeckId() { return ankiDeckId; }
    public String getName() { return name; }
    public Language getLanguage() { return language; }
    public String getWordField() { return wordField; }
    public String getMeaningField() { return meaningField; }
    public Instant getFirstSyncedAt() { return firstSyncedAt; }
}
