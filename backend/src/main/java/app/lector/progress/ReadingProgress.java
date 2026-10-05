package app.lector.progress;

import app.lector.text.Text;
import app.lector.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * How far one user has read one text. Positions are token indexes, not page numbers, because the reader cuts pages
 * to fit the screen. {@code position} is where reading stopped (where to resume); {@code percent} is the share of the
 * words before the furthest position reached, so re-reading an earlier page doesn't lower it.
 */
@Entity
@Table(name = "reading_progress", uniqueConstraints = @UniqueConstraint(name = "uk_progress_user_text",
        columnNames = {"user_id", "text_id"}))
public class ReadingProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "text_id")
    private Text text;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int percent;

    /** Set by "Finish lesson"; re-reading afterwards keeps it. */
    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false)
    private Instant updatedAt;

    protected ReadingProgress() {}

    public ReadingProgress(User user, Text text) {
        this.user = user;
        this.text = text;
    }

    public Long getTextId() {
        return text.getId();
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public int getPercent() {
        return percent;
    }

    public void setPercent(int percent) {
        this.percent = percent;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
