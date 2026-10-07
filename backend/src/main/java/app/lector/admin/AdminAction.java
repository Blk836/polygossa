package app.lector.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** One thing an admin did to an account, kept as the panel's record (emails copied, so it survives renames). */
@Entity
@Table(name = "admin_actions")
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant at;

    @Column(nullable = false)
    private String adminEmail;

    @Column(nullable = false)
    private String action;

    private Long targetUserId;

    private String targetEmail;

    @Column(columnDefinition = "text")
    private String detail;

    protected AdminAction() {}

    public AdminAction(Instant at, String adminEmail, String action, Long targetUserId, String targetEmail,
                       String detail) {
        this.at = at;
        this.adminEmail = adminEmail;
        this.action = action;
        this.targetUserId = targetUserId;
        this.targetEmail = targetEmail;
        this.detail = detail;
    }

    public Instant getAt() { return at; }
    public String getAdminEmail() { return adminEmail; }
    public String getAction() { return action; }
    public Long getTargetUserId() { return targetUserId; }
    public String getTargetEmail() { return targetEmail; }
    public String getDetail() { return detail; }
}
