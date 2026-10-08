package app.lector.vocab;

import app.lector.srs.SrsState;
import app.lector.text.Text;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.List;

/** A word or phrase in a user's personal vocabulary list for one language. */
@Entity
@Table(name = "vocabulary_entries",
        uniqueConstraints = @UniqueConstraint(name = "uk_vocab_user_lang_term", columnNames = {"user_id", "language", "term"}),
        indexes = @Index(name = "idx_vocab_user_lang_status", columnList = "user_id,language,status"))
public class VocabularyEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    /** Normalized lookup key (lower-cased; dictionary form when known). */
    @Column(nullable = false, length = 500)
    private String term;

    /** The form as first encountered, for display. */
    @Column(nullable = false, length = 500)
    private String displayTerm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EntryKind kind = EntryKind.WORD;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WordStatus status = WordStatus.LEARNING;

    @Column(columnDefinition = "text")
    private String definition;

    /**
     * The word in the learner's own language ("perro"), apart from the definition, so learners' meanings can add up to
     * community meanings. Null for words saved before meanings were kept, and when the learner cleared it.
     */
    @Column(length = 200)
    private String meaning;

    /** The native language {@link #meaning} is in: the learner's when it was saved. */
    @Enumerated(EnumType.STRING)
    private NativeLanguage meaningLanguage;

    private String partOfSpeech;

    private String pronunciation;

    @Column(columnDefinition = "text")
    private String example;

    /** The sentence the word was first encountered in. */
    @Column(columnDefinition = "text")
    private String contextSentence;

    /** The learner's own note: a mnemonic, a grammar reminder. */
    @Column(columnDefinition = "text")
    private String note;

    /** The learner's tags, space-separated and padded (" animals a1 ") so a whole tag matches with LIKE. */
    @Column(columnDefinition = "text")
    private String tags;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_text_id")
    private Text sourceText;

    @Embedded
    private SrsState srs = new SrsState();

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    /** When the entry was (most recently) marked known; drives the vocabulary growth chart. */
    private Instant knownAt;

    protected VocabularyEntry() {}

    public VocabularyEntry(User user, Language language, String term, String displayTerm, EntryKind kind) {
        this.user = user;
        this.language = language;
        this.term = term;
        this.displayTerm = displayTerm;
        this.kind = kind;
    }

    public void changeStatus(WordStatus newStatus) {
        if (newStatus == status) {
            return;
        }
        status = newStatus;
        knownAt = newStatus == WordStatus.KNOWN ? Instant.now() : null;
        if (newStatus == WordStatus.LEARNING) {
            srs = new SrsState();
        }
        touch();
    }

    /** Marks an imported word known as of {@code knownAt} (when it was learned elsewhere, not now). */
    public void knownSince(Instant knownAt) {
        status = WordStatus.KNOWN;
        this.knownAt = knownAt;
        touch();
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Language getLanguage() { return language; }
    public String getTerm() { return term; }
    public String getDisplayTerm() { return displayTerm; }
    public EntryKind getKind() { return kind; }
    public WordStatus getStatus() { return status; }
    public String getDefinition() { return definition; }
    public void setDefinition(String definition) { this.definition = definition; }
    public String getMeaning() { return meaning; }
    public NativeLanguage getMeaningLanguage() { return meaningLanguage; }
    /** Sets the meaning in {@code language}; a null meaning clears both. */
    public void setMeaning(String meaning, NativeLanguage language) {
        this.meaning = meaning;
        this.meaningLanguage = meaning == null ? null : language;
    }
    public String getPartOfSpeech() { return partOfSpeech; }
    public void setPartOfSpeech(String partOfSpeech) { this.partOfSpeech = partOfSpeech; }
    public String getPronunciation() { return pronunciation; }
    public void setPronunciation(String pronunciation) { this.pronunciation = pronunciation; }
    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
    public String getContextSentence() { return contextSentence; }
    public void setContextSentence(String contextSentence) { this.contextSentence = contextSentence; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public List<String> getTags() { return tags == null ? List.of() : List.of(tags.strip().split(" ")); }
    /** Tags must already be normalized ({@link Tags#normalize}). */
    public void setTags(List<String> list) { tags = list.isEmpty() ? null : " " + String.join(" ", list) + " "; }
    public Text getSourceText() { return sourceText; }
    public void setSourceText(Text sourceText) { this.sourceText = sourceText; }
    public SrsState getSrs() { return srs; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getKnownAt() { return knownAt; }
}
