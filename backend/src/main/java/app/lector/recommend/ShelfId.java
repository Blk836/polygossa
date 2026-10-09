package app.lector.recommend;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum ShelfId {
    CONTINUE,
    FOR_YOU,
    BECAUSE,
    TOPIC,
    JUST_RIGHT,
    STRETCH;

    private static final String CODES = Arrays.stream(values()).map(ShelfId::code).collect(Collectors.joining(", "));

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    @JsonCreator
    public static ShelfId parse(String value) {
        for (ShelfId s : values()) {
            if (s.code().equals(value)) {
                return s;
            }
        }
        throw new IllegalArgumentException("shelf must be one of: " + CODES);
    }
}
