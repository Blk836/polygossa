package app.lector.curator;

import app.lector.curator.CuratedVideoService.CuratedVideo;
import app.lector.text.Category;
import app.lector.token.Language;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints for the tools/ video importer; every request needs the curator token ({@link CuratorAccess}). */
@RestController
@RequestMapping("/api/curator")
public class CuratorController {

    public record VideoRequest(String url, Language language, Category category, boolean dryRun) {}

    /** What a list file may use, so the tool can check its lines before importing anything. */
    public record Options(List<Language> languages, List<Category> categories) {}

    private final CuratedVideoService videos;

    public CuratorController(CuratedVideoService videos) {
        this.videos = videos;
    }

    @GetMapping("/options")
    public Options options() {
        return new Options(List.of(Language.values()), List.of(Category.values()));
    }

    @PostMapping("/videos")
    public ResponseEntity<CuratedVideo> importVideo(@RequestBody VideoRequest req) {
        CuratedVideo result = videos.importVideo(req.url(), req.language(), req.category(), req.dryRun());
        return ResponseEntity.status(result.imported() ? HttpStatus.CREATED : HttpStatus.OK).body(result);
    }
}
