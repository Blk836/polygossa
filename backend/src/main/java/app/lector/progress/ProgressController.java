package app.lector.progress;

import app.lector.text.TextDtos.ProgressDto;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressController {

    public record ProgressRequest(@NotNull @PositiveOrZero Integer position) {}

    private final ProgressService progress;
    private final CurrentUser currentUser;

    public ProgressController(ProgressService progress, CurrentUser currentUser) {
        this.progress = progress;
        this.currentUser = currentUser;
    }

    @PostMapping("/api/texts/{id}/progress")
    public ProgressDto save(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                            @Valid @RequestBody ProgressRequest req) {
        return progress.record(currentUser.load(principal), id, req.position());
    }
}
