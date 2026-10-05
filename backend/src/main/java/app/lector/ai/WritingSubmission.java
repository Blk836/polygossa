package app.lector.ai;

import app.lector.text.Text;
import app.lector.token.Language;
import app.lector.user.User;
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
import java.time.Instant;

/** A short written response to a text plus the AI tutor's corrective feedback. */
@Entity
@Table(name = "writing_submissions")
public class WritingSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "text_id")
    private Text text;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** JSON produced by the tutor: corrected text, list of corrections with explanations, overall comment. */
    @Column(columnDefinition = "text")
    private String feedbackJson;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected WritingSubmission() {}

    public WritingSubmission(User user, Text text, Language language, String content) {
        this.user = user;
        this.text = text;
        this.language = language;
        this.content = content;
    }

    public Long getId() { return id; }
    public Text getText() { return text; }
    public Language getLanguage() { return language; }
    public String getContent() { return content; }
    public String getFeedbackJson() { return feedbackJson; }
    public void setFeedbackJson(String feedbackJson) { this.feedbackJson = feedbackJson; }
    public Instant getCreatedAt() { return createdAt; }
}
