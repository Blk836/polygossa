package app.lector.vocab;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum EntryKind {
    WORD,
    PHRASE;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }
}
