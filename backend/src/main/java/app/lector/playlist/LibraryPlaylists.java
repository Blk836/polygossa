package app.lector.playlist;

import app.lector.text.Text;
import app.lector.token.Language;
import app.lector.user.User;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public playlists the team curates for the community library (tools/import-videos.mjs --playlist): one per title
 * and language, so running the tool again updates it, and people who saved it keep it.
 */
@Service
public class LibraryPlaylists {

    /** What a curated playlist will be: its title and description, checked like any playlist's. */
    public record Draft(String title, String description, Language language) {}

    private final PlaylistRepository playlists;
    private final PlaylistItemRepository items;
    private final Clock clock;

    public LibraryPlaylists(PlaylistRepository playlists, PlaylistItemRepository items, Clock clock) {
        this.playlists = playlists;
        this.items = items;
        this.clock = clock;
    }

    /** Checks the title and description as the Library's playlist form does (trimmed; 400 when over the limits). */
    public Draft draft(String title, String description, Language language) {
        return new Draft(PlaylistService.title(title), PlaylistService.description(description), language);
    }

    public Optional<Playlist> find(User owner, Draft draft) {
        return playlists.findByOwnerIdAndLanguageAndTitle(owner.getId(), draft.language(), draft.title()).stream()
                .findFirst();
    }

    /** Creates the playlist, or makes the existing one match: its description and items, in the given order. */
    @Transactional
    public Playlist save(User owner, Draft draft, List<Text> texts) {
        Playlist playlist = find(owner, draft).orElseGet(() -> new Playlist(owner, draft.title(), draft.language(),
                clock.instant()));
        playlist.setDescription(draft.description());
        playlist.setPublic(true);
        playlist.setUpdatedAt(clock.instant());
        playlists.save(playlist);
        items.deleteByPlaylistId(playlist.getId());
        for (int i = 0; i < texts.size(); i++) {
            items.save(new PlaylistItem(playlist, texts.get(i), i));
        }
        return playlist;
    }
}
