package app.lector.forum;

import app.lector.forum.ForumDtos.Post;
import app.lector.forum.ForumDtos.ThreadList;
import app.lector.forum.ForumDtos.ThreadPage;
import app.lector.forum.ForumDtos.ThreadSummary;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
@RequestMapping("/api/forum")
public class ForumController {

    public record NewThread(String category, String title, String body) {}

    public record PostBody(String body) {}

    public record Moderation(Boolean pinned, Boolean locked) {}

    private final ForumService forum;
    private final CurrentUser currentUser;

    public ForumController(ForumService forum, CurrentUser currentUser) {
        this.forum = forum;
        this.currentUser = currentUser;
    }

    @GetMapping("/threads")
    public ThreadList list(@AuthenticationPrincipal AuthUser principal,
                           @RequestParam(required = false) String category,
                           @RequestParam(defaultValue = "0") int page) {
        return forum.list(currentUser.load(principal), category, page);
    }

    @PostMapping("/threads")
    @ResponseStatus(HttpStatus.CREATED)
    public ThreadSummary start(@AuthenticationPrincipal AuthUser principal, @RequestBody NewThread req) {
        return forum.start(currentUser.load(principal), req.category(), req.title(), req.body());
    }

    @GetMapping("/threads/{id}")
    public ThreadPage show(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                           @RequestParam(defaultValue = "0") int page) {
        return forum.show(currentUser.load(principal), id, page);
    }

    @PatchMapping("/threads/{id}")
    public ThreadSummary moderate(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                  @RequestBody Moderation req) {
        return forum.moderate(currentUser.load(principal), id, req.pinned(), req.locked());
    }

    @PostMapping("/threads/{id}/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public Post reply(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id, @RequestBody PostBody req) {
        return forum.reply(currentUser.load(principal), id, req.body());
    }

    @PatchMapping("/posts/{id}")
    public Post edit(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id, @RequestBody PostBody req) {
        return forum.edit(currentUser.load(principal), id, req.body());
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        forum.delete(currentUser.load(principal), id);
    }
}
