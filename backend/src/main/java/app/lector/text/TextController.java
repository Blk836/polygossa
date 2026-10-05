package app.lector.text;

import app.lector.common.ApiException;
import app.lector.progress.ProgressService;
import app.lector.storage.StorageService;
import app.lector.text.TextDtos.TextDetail;
import app.lector.text.TextDtos.TextSummary;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import app.lector.vocab.VocabularyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/texts")
public class TextController {

    public record CreateTextRequest(@NotBlank String title, @NotNull Language language, @NotBlank String content,
                                    boolean isPublic, Category category) {}

    public record ImportUrlRequest(@NotBlank String url, @NotNull Language language, String title, boolean isPublic,
                                   Category category) {}

    public record UpdateTextRequest(String title, Boolean isPublic, Category category) {}

    public record AudioUrlRequest(@NotBlank String url) {}

    public record AutoAlignRequest(@Positive long durationMs) {}

    public record MarkKnownRequest(@NotNull @PositiveOrZero Integer fromToken, @NotNull @PositiveOrZero Integer toToken) {}

    public record MarksRequest(@NotNull List<AudioAligner.SentenceMark> marks, @Positive long durationMs) {}

    public record CompleteResponse(int markedKnown) {}

    private final TextService service;
    private final UrlImporter urlImporter;
    private final CurrentUser currentUser;
    private final StorageService storage;
    private final TextAudioService audio;
    private final VocabularyService vocabulary;
    private final ProgressService progress;
    private final ContentReview review;

    public TextController(TextService service, UrlImporter urlImporter, CurrentUser currentUser,
                          StorageService storage, TextAudioService audio, VocabularyService vocabulary,
                          ProgressService progress, ContentReview review) {
        this.service = service;
        this.urlImporter = urlImporter;
        this.currentUser = currentUser;
        this.storage = storage;
        this.audio = audio;
        this.vocabulary = vocabulary;
        this.progress = progress;
        this.review = review;
    }

    @GetMapping
    public List<TextSummary> list(@AuthenticationPrincipal AuthUser principal,
                                  @RequestParam(required = false) MediaKind kind,
                                  @RequestParam(required = false) Language language,
                                  @RequestParam(required = false) Category category) {
        User user = currentUser.load(principal);
        return progress.attach(user, service.listMine(user, kind, language, category));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TextSummary create(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody CreateTextRequest req) {
        User user = currentUser.load(principal);
        Text text = service.create(user, req.title(), req.language(), req.content(), null, req.isPublic(), null);
        text.setCategory(review.categoryFor(req.category(), text, null));
        return service.statsSummary(user, text);
    }

    @PostMapping("/import-url")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TextSummary importUrl(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody ImportUrlRequest req) {
        User user = currentUser.load(principal);
        UrlImporter.Article article = urlImporter.fetch(req.url());
        String title = req.title() != null && !req.title().isBlank() ? req.title() : article.title();
        Text text = service.create(user, title, req.language(), article.body(), article.url(), req.isPublic(), null);
        text.setCategory(review.categoryFor(req.category(), text, null));
        return service.statsSummary(user, text);
    }

    @PostMapping(value = "/import-subtitles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TextSummary importSubtitles(@AuthenticationPrincipal AuthUser principal,
                                       @RequestPart("file") MultipartFile file,
                                       @RequestParam("language") Language language,
                                       @RequestParam(value = "title", required = false) String title,
                                       @RequestParam(value = "isPublic", defaultValue = "false") boolean isPublic,
                                       @RequestParam(value = "category", required = false) Category category) {
        User user = currentUser.load(principal);
        Text text = service.importSubtitles(user, file, title, language, isPublic);
        text.setCategory(review.categoryFor(category, text, null));
        return service.statsSummary(user, text);
    }

    @GetMapping("/{id}")
    public TextDetail get(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        User user = currentUser.load(principal);
        return progress.attach(user, service.detail(user, id));
    }

    @PatchMapping("/{id}")
    @Transactional
    public TextSummary update(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                              @RequestBody UpdateTextRequest req) {
        User user = currentUser.load(principal);
        return service.statsSummary(user, service.update(user, id, req.title(), req.isPublic(), req.category()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.delete(currentUser.load(principal), id);
    }

    @PostMapping("/{id}/complete")
    public CompleteResponse complete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        User user = currentUser.load(principal);
        int marked = vocabulary.markUnseenKnown(user, id);
        progress.complete(user, id);
        return new CompleteResponse(marked);
    }

    /** The reader's page turn: the new words in a token range (one page) become known. */
    @PostMapping("/{id}/mark-known")
    public CompleteResponse markKnown(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                      @Valid @RequestBody MarkKnownRequest req) {
        return new CompleteResponse(vocabulary.markUnseenKnown(currentUser.load(principal), id, req.fromToken(),
                req.toToken()));
    }

    // ---- audio sync ----

    @PostMapping(value = "/{id}/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public TextDetail uploadAudio(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                  @RequestPart("file") MultipartFile file) {
        User user = currentUser.load(principal);
        audio.attachFile(user, id, file);
        return service.detail(user, id);
    }

    @PutMapping("/{id}/audio-url")
    @Transactional
    public TextDetail linkAudio(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                @Valid @RequestBody AudioUrlRequest req) {
        User user = currentUser.load(principal);
        audio.attachUrl(user, id, req.url());
        return service.detail(user, id);
    }

    @DeleteMapping("/{id}/audio")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeAudio(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        audio.remove(currentUser.load(principal), id);
    }

    /** Streams uploaded audio; Spring answers HTTP Range requests for Resource bodies, so seeking works. */
    @GetMapping("/{id}/audio")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> audio(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        Text text = service.loadReadable(currentUser.load(principal), id);
        if (text.getAudioFile() == null) {
            throw ApiException.notFound("Audio");
        }
        Resource resource = storage.load(text.getAudioFile());
        MediaType type = text.getAudioContentType() != null
                ? MediaType.parseMediaType(text.getAudioContentType())
                : MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok().contentType(type).body(resource);
    }

    @PostMapping("/{id}/timings/auto")
    public Map<String, Object> autoAlign(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                         @Valid @RequestBody AutoAlignRequest req) {
        return Map.of("timings", audio.alignAuto(currentUser.load(principal), id, req.durationMs()));
    }

    @PostMapping("/{id}/timings/marks")
    public Map<String, Object> alignMarks(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                          @Valid @RequestBody MarksRequest req) {
        return Map.of("timings", audio.alignFromMarks(currentUser.load(principal), id, req.marks(), req.durationMs()));
    }
}
