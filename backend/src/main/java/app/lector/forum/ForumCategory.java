package app.lector.forum;

import app.lector.common.ApiException;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum ForumCategory {
    ANNOUNCEMENTS, BUGS, IDEAS, GENERAL;

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static ForumCategory parse(String code) {
        for (ForumCategory c : values()) {
            if (c.code().equals(code)) {
                return c;
            }
        }
        throw ApiException.badRequest("category must be one of: announcements, bugs, ideas, general");
    }
}
