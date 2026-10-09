package app.lector.vocab;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum WordStatus {
    LEARNING,
    KNOWN,
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
