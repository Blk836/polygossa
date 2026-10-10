package app.lector.anki;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum AnkiCardState {
    NEW, YOUNG, MATURE;

    static final int MATURE_DAYS = 21;
    private static final int REVIEW = 2;

    static AnkiCardState of(int type, int interval) {
        if (type == 0) {
            return NEW;
        }
        return type == REVIEW && interval >= MATURE_DAYS ? MATURE : YOUNG;
    }

    static AnkiCardState best(AnkiCardState a, AnkiCardState b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
