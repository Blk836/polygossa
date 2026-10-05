package app.lector.srs;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** The three-button difficulty rating shown after revealing a card. */
public enum Rating {
    FORGOT,
    HARD,
    EASY;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static Rating parse(String value) {
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
