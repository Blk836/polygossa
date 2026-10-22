package app.lector.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "phrase_counts")
public class PhraseCount {

    @Id
    @Column(name = "entry_id")
    private Long entryId;

    @Column(nullable = false)
    private long times;

    protected PhraseCount() {}

    public long getTimes() {
        return times;
    }
}
