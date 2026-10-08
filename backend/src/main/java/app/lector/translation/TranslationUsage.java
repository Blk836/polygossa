package app.lector.translation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Characters sent to Amazon Translate in one month (UTC, "2026-10"), counted against the monthly cap. */
@Entity
@Table(name = "translation_usage")
public class TranslationUsage {

    @Id
    @Column(length = 7)
    private String month;

    @Column(nullable = false)
    private long characters;

    protected TranslationUsage() {}

    public String getMonth() { return month; }
    public long getCharacters() { return characters; }
}
