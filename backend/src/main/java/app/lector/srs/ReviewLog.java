package app.lector.srs;

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
import java.time.LocalDate;

/** One flashcard review; drives the daily goal and streak. */
@Entity
@Table(name = "review_logs", indexes = @Index(name = "idx_review_user_date", columnList = "user_id,review_date"))
public class ReviewLog {

    public enum CardType { WORD, SENTENCE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CardType cardType;

    @Column(nullable = false)
    private Long cardId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rating rating;

    @Column(nullable = false)
    private Instant reviewedAt = Instant.now();

    /** Calendar day in the user's time zone. */
    @Column(name = "review_date", nullable = false)
    private LocalDate reviewDate;

    protected ReviewLog() {}

    public ReviewLog(User user, CardType cardType, Long cardId, Rating rating, LocalDate reviewDate) {
        this.user = user;
        this.cardType = cardType;
        this.cardId = cardId;
        this.rating = rating;
        this.reviewDate = reviewDate;
    }

    public Long getId() { return id; }
    public CardType getCardType() { return cardType; }
    public Long getCardId() { return cardId; }
    public Rating getRating() { return rating; }
    public Instant getReviewedAt() { return reviewedAt; }
    public LocalDate getReviewDate() { return reviewDate; }
}
