package app.lector.playlist;

import app.lector.playlist.PlaylistDtos.PlaylistDetail;
import app.lector.playlist.PlaylistDtos.PlaylistSummary;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/playlists")
public class PlaylistController {

    public record CreatePlaylistRequest(String title, String description, Language language) {}

    public record UpdatePlaylistRequest(String title, String description, Boolean isPublic) {}

    public record ReorderRequest(@NotNull List<Long> textIds) {}

    private final PlaylistService service;
    private final CurrentUser currentUser;

    public PlaylistController(PlaylistService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<PlaylistSummary> mine(@AuthenticationPrincipal AuthUser principal,
                                      @RequestParam(required = false) Language language,
                                      @RequestParam(required = false) Long textId) {
        return service.mine(currentUser.load(principal), language, textId);
    }

    @GetMapping("/shared")
    public List<PlaylistSummary> shared(@AuthenticationPrincipal AuthUser principal,
                                        @RequestParam(required = false) Language language,
                                        @RequestParam(required = false) String q) {
        return service.shared(currentUser.load(principal), language, q);
    }

    @GetMapping("/saved")
    public List<PlaylistSummary> saved(@AuthenticationPrincipal AuthUser principal,
                                       @RequestParam(required = false) Language language) {
        return service.saved(currentUser.load(principal), language);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaylistSummary create(@AuthenticationPrincipal AuthUser principal,
                                  @RequestBody CreatePlaylistRequest req) {
        return service.create(currentUser.load(principal), req.title(), req.description(), req.language());
    }

    @GetMapping("/{id}")
    public PlaylistDetail detail(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return service.detail(currentUser.load(principal), id);
    }

    @PatchMapping("/{id}")
    public PlaylistSummary update(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                  @RequestBody UpdatePlaylistRequest req) {
        return service.update(currentUser.load(principal), id, req.title(), req.description(), req.isPublic());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.delete(currentUser.load(principal), id);
    }

    @PutMapping("/{id}/items/{textId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id, @PathVariable Long textId) {
        service.addItem(currentUser.load(principal), id, textId);
    }

    @DeleteMapping("/{id}/items/{textId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id, @PathVariable Long textId) {
        service.removeItem(currentUser.load(principal), id, textId);
    }

    @PutMapping("/{id}/items")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                        @Valid @RequestBody ReorderRequest req) {
        service.reorder(currentUser.load(principal), id, req.textIds());
    }

    @PutMapping("/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void bookmark(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.bookmark(currentUser.load(principal), id);
    }

    @DeleteMapping("/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unbookmark(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.unbookmark(currentUser.load(principal), id);
    }
}
