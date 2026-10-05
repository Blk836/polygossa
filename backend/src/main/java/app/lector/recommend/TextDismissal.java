package app.lector.recommend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/** "Not interested": the learner doesn't want this item recommended again. */
@Entity
@Table(name = "text_dismissals", uniqueConstraints = @UniqueConstraint(name = "uk_dismissal",
        columnNames = {"user_id", "text_id"}))
public class TextDismissal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    @Column(nullable = false)
    private Instant createdAt;

    protected TextDismissal() {}

    public TextDismissal(Long userId, Long textId, Instant createdAt) {
        this.userId = userId;
        this.textId = textId;
        this.createdAt = createdAt;
    }

    public Long getTextId() { return textId; }
    public Instant getCreatedAt() { return createdAt; }
}
