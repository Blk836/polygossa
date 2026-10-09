package app.lector.classroom;

import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/classes")
public class ClassroomController {

    public record CreateRequest(@NotBlank @Size(max = 120) String name, @NotNull Language language) {}

    public record JoinRequest(@NotBlank String code) {}

    public record AssignRequest(@NotNull Long textId, LocalDate dueDate, @Size(max = 1000) String note) {}

    private final ClassroomService service;
    private final CurrentUser currentUser;

    public ClassroomController(ClassroomService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<ClassroomService.ClassSummary> list(@AuthenticationPrincipal AuthUser principal) {
        return service.listForUser(currentUser.load(principal));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomService.ClassSummary create(@AuthenticationPrincipal AuthUser principal,
                                                @Valid @RequestBody CreateRequest req) {
        return service.create(currentUser.load(principal), req.name(), req.language());
    }

    @PostMapping("/join")
    public ClassroomService.ClassSummary join(@AuthenticationPrincipal AuthUser principal,
                                              @Valid @RequestBody JoinRequest req) {
        return service.join(currentUser.load(principal), req.code());
    }

    @GetMapping("/{id}")
    public ClassroomService.ClassDetail detail(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return service.detail(currentUser.load(principal), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        service.delete(currentUser.load(principal), id);
    }

    @PostMapping("/{id}/code")
    public ClassroomService.ClassSummary regenerateCode(@AuthenticationPrincipal AuthUser principal,
                                                        @PathVariable Long id) {
        return service.regenerateCode(currentUser.load(principal), id);
    }

    @PostMapping("/{id}/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomService.AssignmentDto assign(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                                 @Valid @RequestBody AssignRequest req) {
        return service.assign(currentUser.load(principal), id, req.textId(), req.dueDate(), req.note());
    }

    @DeleteMapping("/{id}/assignments/{assignmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unassign(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                         @PathVariable Long assignmentId) {
        service.unassign(currentUser.load(principal), id, assignmentId);
    }

    @DeleteMapping("/{id}/members/{studentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                             @PathVariable Long studentId) {
        service.removeMember(currentUser.load(principal), id, studentId);
    }

    @GetMapping("/{id}/progress")
    public ClassroomService.ClassProgress progress(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        return service.progress(currentUser.load(principal), id);
    }
}
