package app.lector.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Locale;

public enum GoalKind {
    REVIEWS(1, 500),
    WORDS_READ(50, 50_000),
    MINUTES_READ(1, 600),
    MINUTES_LISTENED(1, 600);

    private final int min;
    private final int max;

    GoalKind(int min, int max) {
        this.min = min;
        this.max = max;
    }

    public int min() {
        return min;
    }

    public int max() {
        return max;
    }

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static GoalKind parse(String value) {
        return Arrays.stream(values()).filter(k -> k.json().equals(value)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown daily goal: " + value));
    }
}
