package app.lector.forum;

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

@Entity
@Table(name = "forum_threads", indexes = @Index(name = "idx_forum_threads_order", columnList = "pinned,last_post_at"))
public class ForumThread {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ForumCategory category;

    @Column(nullable = false, length = 120)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(name = "last_post_at", nullable = false)
    private Instant lastPostAt;

    private int replyCount;

    private boolean pinned;

    private boolean locked;

    protected ForumThread() {}

    public ForumThread(ForumCategory category, String title, User author, Instant createdAt) {
        this.category = category;
        this.title = title;
        this.author = author;
        this.createdAt = createdAt;
        this.lastPostAt = createdAt;
    }

    public void replied(Instant at) {
        replyCount++;
        lastPostAt = at;
    }

    public void replyDeleted() {
        replyCount = Math.max(0, replyCount - 1);
    }

    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public void setLocked(boolean locked) { this.locked = locked; }

    public Long getId() { return id; }
    public ForumCategory getCategory() { return category; }
    public String getTitle() { return title; }
    public User getAuthor() { return author; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastPostAt() { return lastPostAt; }
    public int getReplyCount() { return replyCount; }
    public boolean isPinned() { return pinned; }
    public boolean isLocked() { return locked; }
}
