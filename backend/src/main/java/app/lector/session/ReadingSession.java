package app.lector.session;

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
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Time spent with a text open in the reader; the client sends heartbeats while the tab is visible. */
@Entity
@Table(name = "reading_sessions", indexes = @Index(name = "idx_sessions_user", columnList = "user_id,started_at"))
public class ReadingSession {

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

    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    @Column(nullable = false)
    private Instant lastActiveAt = Instant.now();

    @Column(nullable = false)
    private long durationSeconds;

    /** Time the audio or video played (null in sessions from before listening was counted). */
    private Long listenedSeconds;

    /** Set when the reader reaches the end of the text ("finish lesson"). */
    private boolean completed;

    protected ReadingSession() {}

    public ReadingSession(User user, Text text, Instant now) {
        this.user = user;
        this.text = text;
        this.language = text.getLanguage();
        this.startedAt = now;
        this.lastActiveAt = now;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Text getText() { return text; }
    public Language getLanguage() { return language; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(Instant lastActiveAt) { this.lastActiveAt = lastActiveAt; }
    public long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(long durationSeconds) { this.durationSeconds = durationSeconds; }
    public long getListenedSeconds() { return listenedSeconds == null ? 0 : listenedSeconds; }
    public void setListenedSeconds(long listenedSeconds) { this.listenedSeconds = listenedSeconds; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
}
