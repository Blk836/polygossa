package app.lector.vocab;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum EntryKind {
    /** A single token. */
    WORD,
    /** A multi-word selection: compound, idiom or set phrase. */
    PHRASE;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }
}
