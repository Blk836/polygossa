package app.lector.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

@Entity
@Table(name = "ai_usage", uniqueConstraints = @UniqueConstraint(name = "uk_ai_usage", columnNames = {"user_id", "usage_day"}))
public class AiUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "usage_day", nullable = false)
    private LocalDate day;

    @Column(name = "calls", nullable = false)
    private int calls;

    protected AiUsage() {}

    public AiUsage(Long userId, LocalDate day, int calls) {
        this.userId = userId;
        this.day = day;
        this.calls = calls;
    }

    public int getCalls() { return calls; }
}
