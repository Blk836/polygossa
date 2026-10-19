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
import org.hibernate.annotations.Formula;

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

    @Column(nullable = false, length = 500)
    private String term;

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

    @Column(length = 200)
    private String meaning;

    @Enumerated(EnumType.STRING)
    private NativeLanguage meaningLanguage;

    private String partOfSpeech;

    @Column(length = 500)
    private String lemma;

    private String pronunciation;

    @Column(columnDefinition = "text")
    private String example;

    @Column(columnDefinition = "text")
    private String contextSentence;

    @Column(columnDefinition = "text")
    private String note;

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

    private Instant knownAt;

    @Formula("(select max(case l.state when 'MATURE' then 3 when 'YOUNG' then 2 else 1 end) "
            + "from anki_links l where l.entry_id = id)")
    private Integer ankiRank;

    @Formula("(select bool_or(l.promoted) from anki_links l where l.entry_id = id)")
    private Boolean ankiPromoted;

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
    public void setMeaning(String meaning, NativeLanguage language) {
        this.meaning = meaning;
        this.meaningLanguage = meaning == null ? null : language;
    }
    public String getPartOfSpeech() { return partOfSpeech; }
    public void setPartOfSpeech(String partOfSpeech) { this.partOfSpeech = partOfSpeech; }
    public String getLemma() { return lemma; }
    public void setLemma(String lemma) { this.lemma = lemma; }
    public String getPronunciation() { return pronunciation; }
    public void setPronunciation(String pronunciation) { this.pronunciation = pronunciation; }
    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
    public String getContextSentence() { return contextSentence; }
    public void setContextSentence(String contextSentence) { this.contextSentence = contextSentence; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public List<String> getTags() { return tags == null ? List.of() : List.of(tags.strip().split(" ")); }
    public void setTags(List<String> list) { tags = list.isEmpty() ? null : " " + String.join(" ", list) + " "; }
    public Text getSourceText() { return sourceText; }
    public void setSourceText(Text sourceText) { this.sourceText = sourceText; }
    public SrsState getSrs() { return srs; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getKnownAt() { return knownAt; }
    public Integer getAnkiRank() { return ankiRank; }
    public boolean isAnkiPromoted() { return Boolean.TRUE.equals(ankiPromoted); }
}
