package app.lector.progress;

import app.lector.token.Language;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "word_counts")
@IdClass(WordCount.Key.class)
public class WordCount {

    public static class Key implements Serializable {
        private Long userId;
        private Language language;
        private String term;

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(userId, k.userId) && language == k.language
                    && Objects.equals(term, k.term);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, language, term);
        }
    }

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Enumerated(EnumType.STRING)
    private Language language;

    @Id
    @Column(length = 500)
    private String term;

    @Column(nullable = false)
    private long times;

    protected WordCount() {}

    public long getTimes() {
        return times;
    }
}
