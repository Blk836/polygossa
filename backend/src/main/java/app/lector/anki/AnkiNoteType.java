package app.lector.anki;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class AnkiNoteType {

    @Column(name = "model_id", nullable = false)
    private long modelId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 100)
    private String wordField;

    @Column(length = 100)
    private String meaningField;

    protected AnkiNoteType() {}

    AnkiNoteType(long modelId, String name, String wordField, String meaningField) {
        this.modelId = modelId;
        this.name = name;
        this.wordField = wordField;
        this.meaningField = meaningField;
    }

    public long getModelId() { return modelId; }
    public String getName() { return name; }
    public String getWordField() { return wordField; }
    public String getMeaningField() { return meaningField; }
}
