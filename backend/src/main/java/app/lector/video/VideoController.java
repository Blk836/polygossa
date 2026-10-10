package app.lector.video;

import app.lector.text.Category;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/texts")
public class VideoController {

    private final VideoImportService videos;
    private final TextService texts;
    private final CurrentUser currentUser;

    public VideoController(VideoImportService videos, TextService texts, CurrentUser currentUser) {
        this.videos = videos;
        this.texts = texts;
        this.currentUser = currentUser;
    }

    @PostMapping(value = "/import-youtube", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TextSummary importYouTube(@AuthenticationPrincipal AuthUser principal,
                                     @RequestParam("url") String url,
                                     @RequestParam("language") Language language,
                                     @RequestParam(value = "title", required = false) String title,
                                     @RequestParam(value = "isPublic", defaultValue = "false") boolean isPublic,
                                     @RequestParam(value = "transcript", required = false) String transcript,
                                     @RequestPart(value = "file", required = false) MultipartFile file,
                                     @RequestParam(value = "category", required = false) Category category) {
        User user = currentUser.load(principal);
        var req = new VideoImportService.VideoImport(url, language, title, isPublic, file, transcript, category);
        return texts.statsSummary(user, videos.importVideo(user, req));
    }
}
