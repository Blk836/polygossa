package app.lector.playlist;

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

@Entity
@Table(name = "playlist_bookmarks",
        uniqueConstraints = @UniqueConstraint(name = "uk_playlist_bookmark", columnNames = {"user_id", "playlist_id"}))
public class PlaylistBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "playlist_id")
    private Playlist playlist;

    @Column(nullable = false)
    private Instant createdAt;

    protected PlaylistBookmark() {}

    public PlaylistBookmark(User user, Playlist playlist, Instant now) {
        this.user = user;
        this.playlist = playlist;
        this.createdAt = now;
    }
}
