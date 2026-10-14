package app.lector.admin;

import app.lector.common.ApiException;
import app.lector.forum.ForumService;
import app.lector.user.Admins;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.Tier;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    public record SuspendRequest(@Size(max = 500) String reason) {}

    public record PlanRequest(@NotNull Tier tier) {}

    private final CurrentUser currentUser;
    private final Admins admins;
    private final AdminStats stats;
    private final AdminUsers users;
    private final AdminLog log;
    private final AdminTranslations translations;
    private final AdminAi ai;

    public AdminController(CurrentUser currentUser, Admins admins, AdminStats stats, AdminUsers users, AdminLog log,
                           AdminTranslations translations, AdminAi ai) {
        this.currentUser = currentUser;
        this.admins = admins;
        this.stats = stats;
        this.users = users;
        this.log = log;
        this.translations = translations;
        this.ai = ai;
    }

    private User admin(AuthUser principal) {
        User user = currentUser.load(principal);
        if (!admins.isAdmin(user)) {
            throw ApiException.forbidden("Only the team can use the admin panel");
        }
        return user;
    }

    @GetMapping("/stats")
    public AdminStats.Stats stats(@AuthenticationPrincipal AuthUser principal,
                                  @RequestParam(defaultValue = "30") int days) {
        admin(principal);
        return stats.stats(checkedDays(days));
    }

    @GetMapping("/translations")
    public AdminTranslations.Report translations(@AuthenticationPrincipal AuthUser principal,
                                                 @RequestParam(defaultValue = "30") int days) {
        admin(principal);
        return translations.report(checkedDays(days));
    }

    @GetMapping("/ai")
    public AdminAi.Report ai(@AuthenticationPrincipal AuthUser principal,
                             @RequestParam(defaultValue = "30") int days) {
        admin(principal);
        return ai.report(checkedDays(days));
    }

    private static int checkedDays(int days) {
        if (days < 1 || days > 365) {
            throw ApiException.badRequest("days must be 1 to 365");
        }
        return days;
    }

    @GetMapping("/users")
    public AdminUsers.UserPage users(@AuthenticationPrincipal AuthUser principal,
                                     @RequestParam(required = false) String q,
                                     @RequestParam(defaultValue = "0") int page) {
        admin(principal);
        return users.search(q, page);
    }

    @GetMapping("/users/{id}")
    public AdminUsers.UserDetail user(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        admin(principal);
        return users.detail(id);
    }

    @PostMapping("/users/{id}/suspend")
    public AdminUsers.UserRow suspend(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                      @Valid @RequestBody SuspendRequest req) {
        return users.suspend(admin(principal), id, req.reason());
    }

    @PostMapping("/users/{id}/unsuspend")
    public AdminUsers.UserRow unsuspend(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return users.unsuspend(admin(principal), id);
    }

    @DeleteMapping("/users/{id}/posts")
    public ForumService.Removed removePosts(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return users.removePosts(admin(principal), id);
    }

    @DeleteMapping("/users/{id}/playlists")
    public Map<String, Integer> removePlaylists(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return users.removePlaylists(admin(principal), id);
    }

    @DeleteMapping("/users/{id}/texts")
    public Map<String, Integer> removeTexts(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return users.removeTexts(admin(principal), id);
    }

    @PostMapping("/users/{id}/unshare")
    public Map<String, Integer> unshare(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return users.unshare(admin(principal), id);
    }

    @PostMapping("/users/{id}/plan")
    public AdminUsers.UserRow plan(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                   @Valid @RequestBody PlanRequest req) {
        return users.changePlan(admin(principal), id, req.tier());
    }

    @DeleteMapping("/texts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeText(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        users.removeText(admin(principal), id);
    }

    @GetMapping("/actions")
    public List<AdminLog.ActionDto> actions(@AuthenticationPrincipal AuthUser principal) {
        admin(principal);
        return log.recent();
    }
}
