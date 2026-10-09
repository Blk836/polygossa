package app.lector.curator;

import app.lector.curator.CuratedPlaylistService.CuratedPlaylist;
import app.lector.curator.CuratedVideoService.CuratedVideo;
import app.lector.text.Category;
import app.lector.text.SubtitleParser.Cue;
import app.lector.token.Language;
import app.lector.video.VideoImportService.VideoCopy;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/curator")
public class CuratorController {

    public record VideoRequest(String url, Language language, Category category, boolean dryRun) {}

    public record CopyRequest(String videoId, Language language, String title, Category category,
                              Integer durationSeconds, String content, List<Cue> cues, boolean dryRun) {

        VideoCopy copy() {
            return new VideoCopy(videoId, language, title, category, durationSeconds, content, cues);
        }
    }

    public record PlaylistRequest(String title, String description, Language language, List<String> videoIds,
                                  boolean dryRun) {}

    public record Options(List<Language> languages, List<Category> categories) {}

    private final CuratedVideoService videos;
    private final CuratedPlaylistService playlists;

    public CuratorController(CuratedVideoService videos, CuratedPlaylistService playlists) {
        this.videos = videos;
        this.playlists = playlists;
    }

    @GetMapping("/options")
    public Options options() {
        return new Options(Language.offered(), List.of(Category.values()));
    }

    @PostMapping("/videos")
    public ResponseEntity<CuratedVideo> importVideo(@RequestBody VideoRequest req) {
        return answer(videos.importVideo(req.url(), req.language(), req.category(), req.dryRun()));
    }

    @GetMapping("/videos/{videoId}/copy")
    public VideoCopy exportVideo(@PathVariable String videoId, @RequestParam Language language) {
        return videos.export(videoId, language);
    }

    @PostMapping("/copies")
    public ResponseEntity<CuratedVideo> copyVideo(@RequestBody CopyRequest req) {
        return answer(videos.copy(req.copy(), req.dryRun()));
    }

    @PostMapping("/playlists")
    public ResponseEntity<CuratedPlaylist> savePlaylist(@RequestBody PlaylistRequest req) {
        CuratedPlaylist result = playlists.save(req.title(), req.description(), req.language(), req.videoIds(),
                req.dryRun());
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result);
    }

    private static ResponseEntity<CuratedVideo> answer(CuratedVideo result) {
        return ResponseEntity.status(result.imported() ? HttpStatus.CREATED : HttpStatus.OK).body(result);
    }
}
