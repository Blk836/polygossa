package app.lector.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

@Entity
@Table(name = "ai_job_usage", uniqueConstraints = @UniqueConstraint(name = "uk_ai_job_usage",
        columnNames = {"day", "job"}))
public class AiJobUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate day;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AiJob job;

    @Column(nullable = false)
    private long calls;

    @Column(nullable = false)
    private long failures;

    @Column(nullable = false)
    private long tokensIn;

    @Column(nullable = false)
    private long tokensOut;

    protected AiJobUsage() {}
}
