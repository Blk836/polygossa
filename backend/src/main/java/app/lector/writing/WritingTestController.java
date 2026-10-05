package app.lector.writing;

import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.writing.WritingTestService.TestDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Timed writing tests: start one on a set situation, hand it in, get it graded. */
@RestController
@RequestMapping("/api/writing/tests")
public class WritingTestController {

    public record StartRequest(@NotNull Language language, @NotBlank String level) {}

    public record SubmitRequest(@Size(max = 8000) String content) {}

    private final WritingTestService service;
    private final CurrentUser currentUser;

    public WritingTestController(WritingTestService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TestDto start(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody StartRequest req) {
        return service.start(currentUser.load(principal), req.language(), req.level());
    }

    @GetMapping
    public List<TestDto> history(@AuthenticationPrincipal AuthUser principal, @RequestParam Language language) {
        return service.history(currentUser.load(principal), language);
    }

    @GetMapping("/{id}")
    public TestDto get(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return service.get(currentUser.load(principal), id);
    }

    @PostMapping("/{id}/submit")
    public TestDto submit(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                          @Valid @RequestBody SubmitRequest req) {
        return service.submit(currentUser.load(principal), id, req.content());
    }

    @PostMapping("/{id}/grade")
    public TestDto grade(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return service.grade(currentUser.load(principal), id);
    }
}
