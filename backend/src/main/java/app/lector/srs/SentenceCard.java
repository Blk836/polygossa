package app.lector.srs;

import app.lector.text.Text;
import app.lector.token.Language;
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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sentence_cards")
public class SentenceCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Column(nullable = false, columnDefinition = "text")
    private String sentence;

    @Column(columnDefinition = "text")
    private String translation;

    @Column(columnDefinition = "text")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_text_id")
    private Text sourceText;

    @Embedded
    private SrsState srs = new SrsState();

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected SentenceCard() {}

    public SentenceCard(User user, Language language, String sentence) {
        this.user = user;
        this.language = language;
        this.sentence = sentence;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Language getLanguage() { return language; }
    public String getSentence() { return sentence; }
    public String getTranslation() { return translation; }
    public void setTranslation(String translation) { this.translation = translation; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Text getSourceText() { return sourceText; }
    public void setSourceText(Text sourceText) { this.sourceText = sourceText; }
    public SrsState getSrs() { return srs; }
    public Instant getCreatedAt() { return createdAt; }
}
