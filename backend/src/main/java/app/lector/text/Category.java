package app.lector.text;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

public enum Category {
    LEARNERS,
    DAILY_LIFE,
    STORIES,
    NEWS,
    CULTURE,
    TRAVEL,
    FOOD,
    SCIENCE,
    HISTORY,
    ENTERTAINMENT,
    OTHER;

    private static final Map<String, Category> YOUTUBE = Map.ofEntries(
            Map.entry("Education", LEARNERS),
            Map.entry("People & Blogs", DAILY_LIFE),
            Map.entry("Howto & Style", DAILY_LIFE),
            Map.entry("Pets & Animals", DAILY_LIFE),
            Map.entry("Travel & Events", TRAVEL),
            Map.entry("News & Politics", NEWS),
            Map.entry("Nonprofits & Activism", NEWS),
            Map.entry("Science & Technology", SCIENCE),
            Map.entry("Film & Animation", ENTERTAINMENT),
            Map.entry("Music", ENTERTAINMENT),
            Map.entry("Comedy", ENTERTAINMENT),
            Map.entry("Entertainment", ENTERTAINMENT),
            Map.entry("Gaming", ENTERTAINMENT),
            Map.entry("Sports", ENTERTAINMENT));

    private static final String CODES = Arrays.stream(values()).map(Category::code).collect(Collectors.joining(", "));

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    @JsonCreator
    public static Category parse(String value) {
        String code = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        for (Category c : values()) {
            if (c.code().equals(code)) {
                return c;
            }
        }
        throw new IllegalArgumentException("category must be one of: " + CODES);
    }

    public static Category fromYouTube(String youtubeCategory) {
        return youtubeCategory == null ? OTHER : YOUTUBE.getOrDefault(youtubeCategory, OTHER);
    }
}
