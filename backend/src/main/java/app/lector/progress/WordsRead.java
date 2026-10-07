package app.lector.progress;

import app.lector.token.Language;
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

/** Words a learner read on one day (in their time zone) in one language, credited as pages are turned. */
@Entity
@Table(name = "words_read", uniqueConstraints = @UniqueConstraint(name = "uk_words_read_user_language_day",
        columnNames = {"user_id", "language", "day"}))
public class WordsRead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false)
    private long words;

    protected WordsRead() {}

    public WordsRead(Long userId, Language language, LocalDate day) {
        this.userId = userId;
        this.language = language;
        this.day = day;
    }

    public void add(long more) {
        words += more;
    }

    public Long getUserId() { return userId; }
    public Language getLanguage() { return language; }
    public LocalDate getDay() { return day; }
    public long getWords() { return words; }
}
