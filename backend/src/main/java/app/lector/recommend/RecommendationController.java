package app.lector.recommend;

import app.lector.recommend.RecommendationFeedback.EventItem;
import app.lector.text.Category;
import app.lector.text.MediaKind;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    public record Interests(List<Category> categories) {}

    public record EventRequest(String type, String shelf, List<EventItem> items) {}

    private final RecommendationService recommendations;
    private final RecommendationFeedback feedback;
    private final RecommendationMetrics metrics;
    private final WeightLearningJob learning;
    private final CurrentUser currentUser;

    public RecommendationController(RecommendationService recommendations, RecommendationFeedback feedback,
                                    RecommendationMetrics metrics, WeightLearningJob learning,
                                    CurrentUser currentUser) {
        this.learning = learning;
        this.recommendations = recommendations;
        this.feedback = feedback;
        this.metrics = metrics;
        this.currentUser = currentUser;
    }

    @GetMapping
    public Recommendations recommend(@AuthenticationPrincipal AuthUser principal,
                                     @RequestParam(required = false) Language language,
                                     @RequestParam(required = false) MediaKind kind,
                                     @RequestParam(required = false) String level) {
        return recommendations.recommend(currentUser.load(principal), language, RecommendationFilter.of(kind, level));
    }

    @PutMapping("/not-interested/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void notInterested(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        feedback.notInterested(currentUser.load(principal), id);
    }

    @DeleteMapping("/not-interested/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void undoNotInterested(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        feedback.undoNotInterested(currentUser.load(principal), id);
    }

    @GetMapping("/interests")
    public Interests interests(@AuthenticationPrincipal AuthUser principal) {
        return new Interests(feedback.interests(currentUser.load(principal)));
    }

    @PutMapping("/interests")
    public Interests setInterests(@AuthenticationPrincipal AuthUser principal, @RequestBody Interests req) {
        return new Interests(feedback.setInterests(currentUser.load(principal), req.categories()));
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void log(@AuthenticationPrincipal AuthUser principal, @RequestBody EventRequest req) {
        feedback.log(currentUser.load(principal), req.type(), req.shelf(), req.items());
    }

    @GetMapping("/weights")
    public WeightLearningJob.Fit weights(@RequestParam(defaultValue = "28") int days,
                                         @RequestParam(defaultValue = "open") String outcome) {
        return learning.fit(days, outcome);
    }

    @GetMapping("/metrics")
    public RecommendationMetrics.Metrics metrics(@RequestParam(defaultValue = "28") int days) {
        return metrics.metrics(days);
    }
}
