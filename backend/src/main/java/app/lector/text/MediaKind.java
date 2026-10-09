package app.lector.text;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum MediaKind {
    TEXT,
    VIDEO;

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static MediaKind parse(String value) {
        for (MediaKind kind : values()) {
            if (kind.name().equalsIgnoreCase(value == null ? "" : value.strip())) {
                return kind;
            }
        }
        throw new IllegalArgumentException("kind must be one of: text, video");
    }

    public static MediaKind of(Text text) {
        return text.isVideo() ? VIDEO : TEXT;
    }
}
