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

    /** An impression's unweighted score parts (interest … format), or null (opens, older pages, Continue reading). */
    private Double partInterest;
    private Double partTopic;
    private Double partComprehension;
    private Double partLevel;
    private Double partPopular;
    private Double partFresh;
    private Double partFormat;

    protected RecommendationEvent() {}

    public RecommendationEvent(Long userId, Long textId, ShelfId shelf, int position, Type type, Instant createdAt) {
        this.userId = userId;
        this.textId = textId;
        this.shelf = shelf.code();
        this.position = position;
        this.type = type;
        this.createdAt = createdAt;
    }

    public Long getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }

    /** The seven parts in Scoring.Part order, or null when none were logged. */
    public double[] parts() {
        if (partInterest == null) {
            return null;
        }
        return new double[] {partInterest, partTopic, partComprehension, partLevel, partPopular, partFresh, partFormat};
    }

    public void setParts(double[] p) {
        partInterest = p[0];
        partTopic = p[1];
        partComprehension = p[2];
        partLevel = p[3];
        partPopular = p[4];
        partFresh = p[5];
        partFormat = p[6];
    }

    public Long getTextId() { return textId; }
    public String getShelf() { return shelf; }
    public int getPosition() { return position; }
    public Type getType() { return type; }
}
