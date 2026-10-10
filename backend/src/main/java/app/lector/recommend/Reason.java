package app.lector.recommend;

import app.lector.text.Category;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Reason(String kind, Double percent, String topic, Category category, String title, Boolean liked,
                     String level, Long likes) {

    static Reason progress(int percent) {
        return new Reason("progress", (double) percent, null, null, null, null, null, null);
    }

    static Reason known(double percent) {
        return new Reason("known", percent, null, null, null, null, null, null);
    }

    static Reason because(String title, boolean liked) {
        return new Reason("because", null, null, null, title, liked, null, null);
    }

    static Reason topic(String topic) {
        return new Reason("topic", null, topic, null, null, null, null, null);
    }

    static Reason category(Category category) {
        return new Reason("category", null, null, category, null, null, null, null);
    }

    static Reason level(String level) {
        return new Reason("level", null, null, null, null, null, level, null);
    }

    static Reason popular(long likes) {
        return new Reason("popular", null, null, null, null, null, null, likes);
    }

    static Reason simple(String kind) {
        return new Reason(kind, null, null, null, null, null, null, null);
    }
}
