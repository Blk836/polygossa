package app.lector.translation;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
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
@Table(name = "lookup_counters", uniqueConstraints = @UniqueConstraint(name = "uk_lookup_counter",
        columnNames = {"day", "source_language", "target_language", "layer"}))
public class LookupCounter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate day;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NativeLanguage targetLanguage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LookupLayer layer;

    @Column(nullable = false)
    private long lookups;

    @Column(nullable = false)
    private long aiCalls;

    @Column(nullable = false)
    private long aiTokensIn;

    @Column(nullable = false)
    private long aiTokensOut;

    @Column(nullable = false)
    private long aiFailures;

    protected LookupCounter() {}
}
