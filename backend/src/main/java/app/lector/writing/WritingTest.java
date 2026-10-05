package app.lector.writing;

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

/** One timed writing test: the situation set, what the learner handed in, and the AI's grade. */
@Entity
@Table(name = "writing_tests")
public class WritingTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Column(nullable = false, length = 2)
    private String level;

    @Column(nullable = false, length = 16)
    private String promptId;

    @Column(nullable = false, columnDefinition = "text")
    private String situation;

    private int minimum;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant deadline;

    @Column(columnDefinition = "text")
    private String content;

    private int wordCount;

    private Instant submittedAt;

    /** The grade as JSON (see WritingGrader.Grade); null until graded. */
    @Column(columnDefinition = "text")
    private String gradeJson;

    /** Why the last grading attempt failed, while ungraded. */
    private String gradeError;

    /** The model and grading-prompt version that produced {@link #gradeJson}. */
    private String gradeModel;

    private String gradePromptVersion;

    protected WritingTest() {}

    public WritingTest(User user, Language language, String level, PromptBank.Prompt prompt, int minimum,
                       Instant startedAt, Instant deadline) {
        this.user = user;
        this.language = language;
        this.level = level;
        this.promptId = prompt.id();
        this.situation = prompt.situation();
        this.minimum = minimum;
        this.startedAt = startedAt;
        this.deadline = deadline;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Language getLanguage() { return language; }
    public String getLevel() { return level; }
    public String getPromptId() { return promptId; }
    public String getSituation() { return situation; }
    public int getMinimum() { return minimum; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getDeadline() { return deadline; }
    public String getContent() { return content; }
    public int getWordCount() { return wordCount; }
    public Instant getSubmittedAt() { return submittedAt; }
    public String getGradeJson() { return gradeJson; }
    public String getGradeError() { return gradeError; }
    public String getGradeModel() { return gradeModel; }
    public String getGradePromptVersion() { return gradePromptVersion; }

    public void handIn(String content, int wordCount, Instant at) {
        this.content = content;
        this.wordCount = wordCount;
        this.submittedAt = at;
    }

    public void graded(String gradeJson, String model, String promptVersion) {
        this.gradeJson = gradeJson;
        this.gradeModel = model;
        this.gradePromptVersion = promptVersion;
        this.gradeError = null;
    }

    public void gradingFailed(String error) {
        this.gradeError = error;
    }
}
