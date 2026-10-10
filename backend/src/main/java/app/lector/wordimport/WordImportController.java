package app.lector.wordimport;

import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/word-imports")
public class WordImportController {

    public record LingqRequest(String apiKey, String language) {}

    private final WordImportService imports;
    private final CurrentUser currentUser;

    public WordImportController(WordImportService imports, CurrentUser currentUser) {
        this.imports = imports;
        this.currentUser = currentUser;
    }

    @PostMapping("/lingq")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public WordImportDto lingq(@AuthenticationPrincipal AuthUser principal, @RequestBody LingqRequest req) {
        return imports.startLingq(currentUser.load(principal), req.apiKey(), req.language());
    }

    @PostMapping("/readlang")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public WordImportDto readlang(@AuthenticationPrincipal AuthUser principal,
                                  @RequestPart(value = "file", required = false) MultipartFile file,
                                  @RequestParam(required = false) String language) {
        return imports.startReadlang(currentUser.load(principal), file, language);
    }

    @GetMapping
    public List<WordImportDto> recent(@AuthenticationPrincipal AuthUser principal) {
        return imports.recent(currentUser.load(principal));
    }

    @GetMapping("/{id}")
    public WordImportDto get(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return imports.get(currentUser.load(principal), id);
    }
}
