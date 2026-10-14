package app.lector.admin;

import app.lector.user.User;
import app.lector.user.UserRepository;
import app.lector.video.TranscriptRetidy;
import org.springframework.stereotype.Service;

@Service
public class AdminTranscripts {

    private final TranscriptRetidy retidy;
    private final UserRepository users;
    private final AdminLog log;

    public AdminTranscripts(TranscriptRetidy retidy, UserRepository users, AdminLog log) {
        this.retidy = retidy;
        this.users = users;
        this.log = log;
    }

    public TranscriptRetidy.Report tidy(User admin, Long textId) {
        TranscriptRetidy.Report report = retidy.retidy(textId);
        users.findById(report.ownerId()).ifPresent(owner -> log.record(admin, "tidy transcript", owner,
                report.title() + ": " + report.tidiedLines() + " of " + report.lines() + " lines"));
        return report;
    }
}
