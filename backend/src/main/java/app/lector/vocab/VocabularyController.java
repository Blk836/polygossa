package app.lector.vocab;

import app.lector.config.Brand;
import app.lector.export.AnkiExporter;
import app.lector.export.CsvExporter;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vocabulary")
public class VocabularyController {

    public record SaveRequest(
            @NotNull Language language,
            @NotBlank String term,
            String displayTerm,
            EntryKind kind,
            WordStatus status,
            String definition,
            String partOfSpeech,
            String pronunciation,
            String example,
            String contextSentence,
            String note,
            List<String> tags,
            Long textId,
            String meaning,
            String lemma) {

        VocabularyService.EntryFields fields() {
            return new VocabularyService.EntryFields(status, definition, partOfSpeech, pronunciation, example,
                    contextSentence, note, tags, meaning, lemma);
        }
    }

    public record UpdateRequest(
            WordStatus status,
            String definition,
            String partOfSpeech,
            String pronunciation,
            String example,
            String contextSentence,
            String note,
            List<String> tags,
            String meaning) {

        VocabularyService.EntryFields fields() {
            return new VocabularyService.EntryFields(status, definition, partOfSpeech, pronunciation, example,
                    contextSentence, note, tags, meaning, null);
        }
    }

    public record PageDto<T>(List<T> items, long total, int page, int size) {
        static <T> PageDto<T> of(Page<T> p) {
            return new PageDto<>(p.getContent(), p.getTotalElements(), p.getNumber(), p.getSize());
        }
    }

    private final VocabularyService service;
    private final VocabularyRepository repo;
    private final CurrentUser currentUser;
    private final Brand brand;

    public VocabularyController(VocabularyService service, VocabularyRepository repo, CurrentUser currentUser,
                                Brand brand) {
        this.brand = brand;
        this.service = service;
        this.repo = repo;
        this.currentUser = currentUser;
    }

    @GetMapping
    public PageDto<VocabularyDto> search(@AuthenticationPrincipal AuthUser principal,
                                         @RequestParam(required = false) Language language,
                                         @RequestParam(required = false) WordStatus status,
                                         @RequestParam(required = false) EntryKind kind,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) String tag,
                                         @RequestParam(defaultValue = "recent") String sort,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return PageDto.of(service.search(currentUser.load(principal), language, status, kind, q, tag, sort, page,
                size));
    }

    @GetMapping("/tags")
    public List<Tags.TagCount> tags(@AuthenticationPrincipal AuthUser principal,
                                    @RequestParam(required = false) Language language) {
        return service.tags(currentUser.load(principal), language);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public VocabularyDto save(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody SaveRequest req) {
        User user = currentUser.load(principal);
        return VocabularyDto.of(service.save(user, req.language(), req.term(), req.displayTerm(), req.kind(),
                req.fields(), req.textId()));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public VocabularyDto get(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return VocabularyDto.of(service.loadOwned(currentUser.load(principal), id));
    }

    @PatchMapping("/{id}")
    @Transactional
    public VocabularyDto update(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                @RequestBody UpdateRequest req) {
        return VocabularyDto.of(service.update(currentUser.load(principal), id, req.fields()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.delete(currentUser.load(principal), id);
    }

    public record BulkDelete(List<Long> ids) {}

    public record Deleted(int deleted) {}

    @PostMapping("/delete")
    public Deleted deleteAll(@AuthenticationPrincipal AuthUser principal, @RequestBody BulkDelete req) {
        return new Deleted(service.deleteAll(currentUser.load(principal), req.ids()));
    }

    @DeleteMapping("/by-term")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteByTerm(@AuthenticationPrincipal AuthUser principal, @RequestParam Language language,
                             @RequestParam String term) {
        service.deleteByTerm(currentUser.load(principal), language, term);
    }

    @GetMapping("/export.csv")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportCsv(@AuthenticationPrincipal AuthUser principal,
                                            @RequestParam(required = false) Language language,
                                            @RequestParam(required = false) WordStatus status) {
        List<VocabularyEntry> entries = entriesForExport(principal, language, status);
        return download(CsvExporter.export(entries), "text/csv; charset=utf-8", fileName(language, "csv"));
    }

    @GetMapping("/export.apkg")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportAnki(@AuthenticationPrincipal AuthUser principal,
                                             @RequestParam(required = false) Language language,
                                             @RequestParam(required = false) WordStatus status) {
        List<VocabularyEntry> entries = entriesForExport(principal, language, status);
        String deckName = brand.name() + (language == null ? "" : "::" + language.displayName());
        return download(AnkiExporter.export(brand.name(), deckName, entries), "application/octet-stream", fileName(language, "apkg"));
    }

    private List<VocabularyEntry> entriesForExport(AuthUser principal, Language language, WordStatus status) {
        User user = currentUser.load(principal);
        return repo.findForExport(user.getId(), language).stream()
                .filter(e -> status == null || e.getStatus() == status)
                .toList();
    }

    private static String fileName(Language language, String ext) {
        return "vocabulary" + (language == null ? "" : "-" + language.code()) + "-" + LocalDate.now() + "." + ext;
    }

    private static ResponseEntity<byte[]> download(byte[] body, String type, String fileName) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(type))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName).build().toString())
                .body(body);
    }
}
