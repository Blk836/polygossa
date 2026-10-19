package app.lector.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Locale;

public enum HoneyJar {
    ALL_FORMS,
    BASE_WORDS;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static HoneyJar parse(String value) {
        return Arrays.stream(values()).filter(h -> h.json().equals(value)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown honey jar count: " + value));
    }
}
