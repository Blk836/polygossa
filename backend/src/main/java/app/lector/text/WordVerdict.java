package app.lector.text;

import app.lector.token.Language;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "word_verdicts")
@IdClass(WordVerdict.Key.class)
class WordVerdict {

    static class Key implements Serializable {
        private Language language;
        private String term;

        protected Key() {}

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && language == k.language && Objects.equals(term, k.term);
        }

        @Override
        public int hashCode() {
            return Objects.hash(language, term);
        }
    }

    @Id
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @Id
    @Column(nullable = false, length = 500)
    private String term;

    @Column(name = "real_word", nullable = false)
    private boolean realWord;

    @Column(nullable = false)
    private Instant judgedAt;

    protected WordVerdict() {}
}
