package app.lector.curator;

import app.lector.common.ApiException;
import app.lector.text.Category;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.LibraryAccount;
import app.lector.text.TextService;
import app.lector.video.VideoImportService;
import app.lector.video.VideoImportService.VideoCopy;
import app.lector.video.VideoImportService.VideoImport;
import app.lector.video.YouTubeUrls;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CuratedVideoService {

    static final String IMPORTED = "imported";
    static final String TRANSCRIBED = "transcribed";
    static final String ALREADY_IMPORTED = "already_imported";

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CuratedVideo(String outcome, Long id, String videoId, String title, Category category) {

        public boolean imported() {
            return IMPORTED.equals(outcome) || TRANSCRIBED.equals(outcome);
        }
    }

    private final LibraryAccount library;
    private final TextRepository texts;
    private final VideoImportService videos;

    private final TextService textService;

    public CuratedVideoService(LibraryAccount library, TextRepository texts, VideoImportService videos,
                               TextService textService) {
        this.library = library;
        this.texts = texts;
        this.videos = videos;
        this.textService = textService;
    }

    @Transactional
    public CuratedVideo importVideo(String url, Language language, Category category, boolean dryRun) {
        String videoId = YouTubeUrls.videoId(url);
        requireLanguage(language);
        Optional<CuratedVideo> settled = alreadyOrDry(videoId, dryRun);
        if (settled.isPresent()) {
            return settled.get();
        }
        var request = new VideoImport(YouTubeUrls.watchUrl(videoId), language, null, true, null, null, category);
        return describe(IMPORTED, videos.importForLibrary(library.getOrCreate(), request));
    }

    @Transactional
    public CuratedVideo importTranscribed(String videoId, Language language, Category category, List<Cue> cues) {
        var request = new VideoImport(YouTubeUrls.watchUrl(videoId), language, null, true, null, null, category);
        return describe(TRANSCRIBED, videos.importTranscribed(library.getOrCreate(), request, cues));
    }

    @Transactional(readOnly = true)
    public Optional<CuratedVideo> existing(String videoId) {
        return library.find()
                .flatMap(owner -> texts.findByOwnerIdAndVideoId(owner.getId(), videoId).stream().findFirst())
                .map(text -> describe(ALREADY_IMPORTED, text));
    }

    @Transactional(readOnly = true)
    public VideoCopy export(String videoId, Language language) {
        requireLanguage(language);
        Text text = texts.findCopiesOfVideo(YouTubeUrls.videoId("https://youtu.be/" + videoId), language).stream()
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "not_on_source",
                        "No " + language.displayName() + " copy of " + videoId + " here"));
        return new VideoCopy(text.getVideoId(), text.getLanguage(), text.getTitle(), text.getCategory(),
                text.getVideoDurationSeconds(), text.getContent(), textService.cues(text));
    }

    @Transactional
    public CuratedVideo copy(VideoCopy copy, boolean dryRun) {
        requireLanguage(copy.language());
        String videoId = YouTubeUrls.videoId("https://youtu.be/" + copy.videoId());
        Optional<CuratedVideo> settled = alreadyOrDry(videoId, dryRun);
        if (settled.isPresent()) {
            return settled.get();
        }
        return describe(IMPORTED, videos.copyForLibrary(library.getOrCreate(), copy));
    }

    private Optional<CuratedVideo> alreadyOrDry(String videoId, boolean dryRun) {
        Optional<CuratedVideo> existing = existing(videoId);
        if (existing.isPresent()) {
            return existing;
        }
        return dryRun ? Optional.of(new CuratedVideo("would_import", null, videoId, null, null)) : Optional.empty();
    }

    private static void requireLanguage(Language language) {
        if (language == null) {
            throw ApiException.badRequest("language is required");
        }
    }

    private static CuratedVideo describe(String outcome, Text text) {
        return new CuratedVideo(outcome, text.getId(), text.getVideoId(), text.getTitle(), text.getCategory());
    }
}
