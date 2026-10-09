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
import java.time.Instant;

@Entity
@Table(name = "machine_translations", uniqueConstraints = @UniqueConstraint(name = "uk_machine_translation",
        columnNames = {"source_language", "target_language", "term"}))
public class MachineTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NativeLanguage targetLanguage;

    @Column(nullable = false, length = 200)
    private String term;

    @Column(length = 500)
    private String translation;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean triedInContext;

    protected MachineTranslation() {}

    public String getTranslation() { return translation; }

    public boolean isTriedInContext() { return triedInContext; }
}
