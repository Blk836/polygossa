package app.lector.curator;

import app.lector.common.ApiException;
import app.lector.playlist.LibraryPlaylists;
import app.lector.playlist.LibraryPlaylists.Draft;
import app.lector.playlist.Playlist;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.LibraryAccount;
import app.lector.user.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Puts curated videos already in the community library into a public library playlist, in the order given
 * (docs/acceptance/copy-playlist.feature). Videos the library doesn't have in that language are left out and listed.
 */
@Service
public class CuratedPlaylistService {

    /**
     * {@code outcome}: {@code created}, {@code updated}, or (dry run) {@code would_create} / {@code would_update};
     * {@code items}: how many videos it holds; {@code missing}: the video ids left out.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CuratedPlaylist(String outcome, Long id, String title, int items, List<String> missing) {

        public boolean created() {
            return "created".equals(outcome);
        }
    }

    private final LibraryAccount library;
    private final TextRepository texts;
    private final LibraryPlaylists playlists;

    public CuratedPlaylistService(LibraryAccount library, TextRepository texts, LibraryPlaylists playlists) {
        this.library = library;
        this.texts = texts;
        this.playlists = playlists;
    }

    @Transactional
    public CuratedPlaylist save(String title, String description, Language language, List<String> videoIds,
                                boolean dryRun) {
        if (language == null) {
            throw ApiException.badRequest("language is required");
        }
        Draft draft = playlists.draft(title, description, language);
        Optional<User> owner = library.find();
        List<Text> found = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String videoId : new LinkedHashSet<>(videoIds == null ? List.<String>of() : videoIds)) {
            owner.flatMap(o -> libraryCopy(o, videoId, language)).ifPresentOrElse(found::add, () -> missing.add(videoId));
        }
        if (found.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "no_videos",
                    "None of these videos are in the community library in " + language.displayName());
        }
        Optional<Playlist> existing = playlists.find(owner.get(), draft);
        if (dryRun) {
            return new CuratedPlaylist(existing.isPresent() ? "would_update" : "would_create",
                    existing.map(Playlist::getId).orElse(null), draft.title(), found.size(), missing);
        }
        Playlist saved = playlists.save(owner.get(), draft, found);
        return new CuratedPlaylist(existing.isPresent() ? "updated" : "created", saved.getId(), draft.title(),
                found.size(), missing);
    }

    private Optional<Text> libraryCopy(User owner, String videoId, Language language) {
        return texts.findByOwnerIdAndVideoId(owner.getId(), videoId).stream()
                .filter(t -> t.getLanguage() == language)
                .findFirst();
    }
}
