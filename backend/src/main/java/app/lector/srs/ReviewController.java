package app.lector.srs;

import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/review")
public class ReviewController {

    public record ReviewRequest(@NotNull Rating rating) {}

    private final ReviewService service;
    private final CurrentUser currentUser;

    public ReviewController(ReviewService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping("/queue")
    public List<ReviewService.Card> queue(@AuthenticationPrincipal AuthUser principal,
                                          @RequestParam(required = false) Language language,
                                          @RequestParam(defaultValue = "50") int limit,
                                          @RequestParam(defaultValue = "false") boolean ahead) {
        return service.queue(currentUser.load(principal), language, limit, ahead);
    }

    @GetMapping("/stats")
    public ReviewService.Stats stats(@AuthenticationPrincipal AuthUser principal,
                                     @RequestParam(required = false) Language language) {
        return service.stats(currentUser.load(principal), language);
    }

    @PostMapping("/{type}/{id}")
    public ReviewService.ReviewResult review(@AuthenticationPrincipal AuthUser principal,
                                             @PathVariable String type, @PathVariable Long id,
                                             @RequestParam(required = false) Language language,
                                             @Valid @RequestBody ReviewRequest req) {
        return service.review(currentUser.load(principal), type, id, req.rating(), language);
    }
}
