package app.lector.library;

import app.lector.text.Text;
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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/** A like or bookmark on community content. */
@Entity
@Table(name = "text_reactions",
        uniqueConstraints = @UniqueConstraint(name = "uk_reaction", columnNames = {"user_id", "text_id", "type"}))
public class TextReaction {

    public enum Type { LIKE, BOOKMARK }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "text_id")
    private Text text;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected TextReaction() {}

    public TextReaction(User user, Text text, Type type) {
        this.user = user;
        this.text = text;
        this.type = type;
    }

    public Long getId() { return id; }
    public Text getText() { return text; }
    public Type getType() { return type; }
}
