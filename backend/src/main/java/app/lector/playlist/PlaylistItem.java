package app.lector.playlist;

import app.lector.text.Text;
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

@Entity
@Table(name = "playlist_items",
        uniqueConstraints = @UniqueConstraint(name = "uk_playlist_item", columnNames = {"playlist_id", "text_id"}))
public class PlaylistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "playlist_id")
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "text_id")
    private Text text;

    @Column(nullable = false)
    private int position;

    protected PlaylistItem() {}

    public PlaylistItem(Playlist playlist, Text text, int position) {
        this.playlist = playlist;
        this.text = text;
        this.position = position;
    }

    public Playlist getPlaylist() { return playlist; }
    public Text getText() { return text; }
    public void setPosition(int position) { this.position = position; }
}
