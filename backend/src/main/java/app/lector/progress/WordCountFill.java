package app.lector.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "word_count_fills")
public class WordCountFill {

    @Id
    @Column(name = "user_id")
    private Long userId;

    protected WordCountFill() {
    }

    public Long getUserId() {
        return userId;
    }
}
