package app.lector.admin;

import app.lector.user.User;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminLog {

    public record ActionDto(Instant at, String admin, String action, String target, String detail) {}

    private final AdminActionRepository actions;
    private final Clock clock;

    public AdminLog(AdminActionRepository actions, Clock clock) {
        this.actions = actions;
        this.clock = clock;
    }

    void record(User admin, String action, User target, String detail) {
        actions.save(new AdminAction(clock.instant(), admin.getEmail(), action, target.getId(), target.getEmail(),
                detail));
    }

    @Transactional(readOnly = true)
    public List<ActionDto> recent() {
        return actions.findTop100ByOrderByIdDesc().stream()
                .map(a -> new ActionDto(a.getAt(), a.getAdminEmail(), a.getAction(), a.getTargetEmail(), a.getDetail()))
                .toList();
    }
}
