package app.lector.curator;

import app.lector.common.ApiException;
import app.lector.text.Category;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.LibraryAccount;
import app.lector.user.User;
import app.lector.video.VideoImportService;
import app.lector.video.VideoImportService.VideoImport;
import app.lector.video.YouTubeUrls;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bulk import of curated YouTube videos into the community library: owned by the library account, shared publicly,
 * no plan limits, and each video only once. Otherwise the same import as the Library form, AI review included.
 */
@Service
public class CuratedVideoService {

    static final String IMPORTED = "imported";

    /** One video's outcome: {@code imported}, {@code already_imported} or (dry run) {@code would_import}. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CuratedVideo(String outcome, Long id, String videoId, String title, Category category) {

        public boolean imported() {
            return IMPORTED.equals(outcome);
        }
    }

    private final LibraryAccount library;
    private final TextRepository texts;
    private final VideoImportService videos;

    public CuratedVideoService(LibraryAccount library, TextRepository texts, VideoImportService videos) {
        this.library = library;
        this.texts = texts;
        this.videos = videos;
    }

    /** Nothing is saved when the import fails (no captions, refused or unchecked by the AI review, …). */
    @Transactional
    public CuratedVideo importVideo(String url, Language language, Category category, boolean dryRun) {
        String videoId = YouTubeUrls.videoId(url);
        if (language == null) {
            throw ApiException.badRequest("language is required");
        }
        Optional<Text> existing = library.find()
                .flatMap(owner -> texts.findByOwnerIdAndVideoId(owner.getId(), videoId).stream().findFirst());
        if (existing.isPresent()) {
            return describe("already_imported", existing.get());
        }
        if (dryRun) {
            return new CuratedVideo("would_import", null, videoId, null, null);
        }
        User owner = library.getOrCreate();
        var request = new VideoImport(YouTubeUrls.watchUrl(videoId), language, null, true, null, null, category);
        return describe(IMPORTED, videos.importForLibrary(owner, request));
    }

    private static CuratedVideo describe(String outcome, Text text) {
        return new CuratedVideo(outcome, text.getId(), text.getVideoId(), text.getTitle(), text.getCategory());
    }
}
