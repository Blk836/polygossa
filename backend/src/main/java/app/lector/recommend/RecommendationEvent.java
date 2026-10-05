package app.lector.recommend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** A recommended item shown on Explore (impression) or opened from it, with its shelf and position. */
@Entity
@Table(name = "recommendation_events", indexes = {
        @Index(name = "idx_rec_events_user", columnList = "user_id,text_id"),
        @Index(name = "idx_rec_events_time", columnList = "created_at")
})
public class RecommendationEvent {

    public enum Type { IMPRESSION, OPEN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    @Column(nullable = false, length = 16)
    private String shelf;

    @Column(nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Type type;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected RecommendationEvent() {}

    public RecommendationEvent(Long userId, Long textId, ShelfId shelf, int position, Type type, Instant createdAt) {
        this.userId = userId;
        this.textId = textId;
        this.shelf = shelf.code();
        this.position = position;
        this.type = type;
        this.createdAt = createdAt;
    }

    public Long getTextId() { return textId; }
    public String getShelf() { return shelf; }
    public int getPosition() { return position; }
    public Type getType() { return type; }
}
