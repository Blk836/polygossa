package app.lector.dictionary;

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
@Table(name = "sentence_meanings", uniqueConstraints = @UniqueConstraint(name = "uk_sentence_meaning",
        columnNames = {"source_language", "target_language", "term", "context_hash"}))
public class SentenceMeaning {

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

    @Column(nullable = false, length = 64)
    private String contextHash;

    @Column(nullable = false, length = 100)
    private String meaning;

    @Column(nullable = false)
    private Instant createdAt;

    protected SentenceMeaning() {}

    public String getMeaning() { return meaning; }
}
