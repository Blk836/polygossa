package app.lector.session;

import app.lector.common.ApiException;
import app.lector.text.TextService;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Reading-time tracking: the reader opens a session and sends heartbeats while the page is visible. */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    public record StartRequest(@NotNull Long textId) {}

    /** Seconds of visible, active reading, and of audio or video playing (absent from older clients). */
    public record HeartbeatRequest(long seconds, Long listenedSeconds) {}

    public record SessionDto(Long id, long durationSeconds, boolean completed) {
        static SessionDto of(ReadingSession s) {
            return new SessionDto(s.getId(), s.getDurationSeconds(), s.isCompleted());
        }
    }

    private final ReadingSessionRepository repo;
    private final TextService texts;
    private final CurrentUser currentUser;
    private final Clock clock;

    public SessionController(ReadingSessionRepository repo, TextService texts, CurrentUser currentUser, Clock clock) {
        this.repo = repo;
        this.texts = texts;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SessionDto start(@AuthenticationPrincipal AuthUser principal, @RequestBody StartRequest req) {
        User user = currentUser.load(principal);
        return SessionDto.of(repo.save(new ReadingSession(user, texts.loadReadable(user, req.textId()),
                clock.instant())));
    }

    /**
     * Adds active reading time and listening time. Each is capped by the wall-clock time since the previous heartbeat
     * (and five minutes) so a client can't inflate its totals.
     */
    @PostMapping("/{id}/heartbeat")
    @Transactional
    public SessionDto heartbeat(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                                @RequestBody HeartbeatRequest req) {
        ReadingSession session = loadOwned(principal, id);
        Instant now = clock.instant();
        long elapsed = Duration.between(session.getLastActiveAt(), now).toSeconds() + 5;
        session.setDurationSeconds(session.getDurationSeconds() + credit(req.seconds(), elapsed));
        if (req.listenedSeconds() != null) {
            session.setListenedSeconds(session.getListenedSeconds() + credit(req.listenedSeconds(), elapsed));
        }
        session.setLastActiveAt(now);
        return SessionDto.of(session);
    }

    @PostMapping("/{id}/complete")
    @Transactional
    public SessionDto complete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        ReadingSession session = loadOwned(principal, id);
        session.setCompleted(true);
        return SessionDto.of(session);
    }

    private static long credit(long claimed, long elapsed) {
        return Math.max(0, Math.min(claimed, Math.min(elapsed, 300)));
    }

    private ReadingSession loadOwned(AuthUser principal, Long id) {
        User user = currentUser.load(principal);
        return repo.findById(id)
                .filter(s -> s.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> ApiException.notFound("Session"));
    }
}
