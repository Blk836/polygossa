package app.lector.vocab;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Reader colour coding: unseen words have no entry at all (white). */
public enum WordStatus {
    /** Yellow — looked up, being learned; counts toward the free-tier saved word limit and goes into SRS review. */
    LEARNING,
    /** Green. */
    KNOWN,
    /** Blue — proper nouns etc. */
    IGNORED;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static WordStatus parse(String value) {
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
