package app.lector.anki;

import app.lector.common.ApiException;
import java.util.Locale;

public enum AnkiOutcome {
    BECAME_KNOWN, ADDED_KNOWN, ADDED_LEARNING, OVER_LIMIT, SKIPPED_EMPTY, SKIPPED_TOO_LONG, SKIPPED_MEDIA, LEAVE_REVIEW;

    static AnkiOutcome skipped(AnkiCardText.Skip skip) {
        return switch (skip) {
            case EMPTY -> SKIPPED_EMPTY;
            case TOO_LONG -> SKIPPED_TOO_LONG;
            case MEDIA -> SKIPPED_MEDIA;
        };
    }

    static AnkiOutcome parse(String code) {
        try {
            return valueOf(code.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.badRequest("Unknown outcome: " + code);
        }
    }
}
