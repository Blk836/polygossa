package app.lector.wordimport;

import app.lector.token.Language;
import app.lector.vocab.ImportCounts;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Locale;

/**
 * One background import of a learner's words from another app, with its progress and result. Holds no credentials:
 * a LingQ API key lives only in memory while the import runs.
 */
@Entity
@Table(name = "word_imports", indexes = @Index(name = "idx_word_imports_user", columnList = "user_id,state"))
public class WordImport {

    public enum Source {
        LINGQ, READLANG;

        @JsonValue
        public String code() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    public enum State {
        QUEUED, RUNNING, DONE, FAILED;

        @JsonValue
        public String code() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Source source;

    /** Null: every language. */
    @Enumerated(EnumType.STRING)
    private Language language;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private State state = State.QUEUED;

    private int found;
    private int added;
    private int updated;
    private int unchanged;
    private int overLimit;

    @Column(length = 300)
    private String error;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant finishedAt;

    protected WordImport() {}

    public WordImport(Long userId, Source source, Language language, Instant createdAt) {
        this.userId = userId;
        this.source = source;
        this.language = language;
        this.createdAt = createdAt;
    }

    public void start() {
        state = State.RUNNING;
    }

    /** Adds one batch: {@code found} words read, and what merging them did. */
    public void record(int foundInBatch, ImportCounts counts) {
        found += foundInBatch;
        added += counts.added();
        updated += counts.updated();
        unchanged += counts.unchanged();
        overLimit += counts.overLimit();
    }

    public void finish(Instant at) {
        state = State.DONE;
        finishedAt = at;
    }

    public void fail(String message, Instant at) {
        state = State.FAILED;
        error = message;
        finishedAt = at;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Source getSource() { return source; }
    public Language getLanguage() { return language; }
    public State getState() { return state; }
    public int getFound() { return found; }
    public int getAdded() { return added; }
    public int getUpdated() { return updated; }
    public int getUnchanged() { return unchanged; }
    public int getOverLimit() { return overLimit; }
    public String getError() { return error; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getFinishedAt() { return finishedAt; }
}
