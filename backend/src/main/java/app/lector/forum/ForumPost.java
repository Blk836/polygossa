package app.lector.forum;

import app.lector.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** One plain-text post in a forum thread. */
@Entity
@Table(name = "forum_posts", indexes = @Index(name = "idx_forum_posts_thread", columnList = "thread_id,id"))
public class ForumPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id")
    private ForumThread thread;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant editedAt;

    protected ForumPost() {}

    public ForumPost(ForumThread thread, User author, String body, Instant createdAt) {
        this.thread = thread;
        this.author = author;
        this.body = body;
        this.createdAt = createdAt;
    }

    public void edit(String newBody, Instant at) {
        body = newBody;
        editedAt = at;
    }

    public Long getId() { return id; }
    public ForumThread getThread() { return thread; }
    public User getAuthor() { return author; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getEditedAt() { return editedAt; }
}
