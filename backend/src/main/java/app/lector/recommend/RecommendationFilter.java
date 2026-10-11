package app.lector.recommend;

import app.lector.common.ApiException;
import app.lector.text.DifficultyEstimator;
import app.lector.text.MediaKind;
import app.lector.text.Text;
import java.util.Locale;

public record RecommendationFilter(MediaKind kind, String level) {

    public static final RecommendationFilter NONE = new RecommendationFilter(null, null);

    public static RecommendationFilter of(MediaKind kind, String level) {
        String lvl = level == null || level.isBlank() ? null : level.strip().toUpperCase(Locale.ROOT);
        if (lvl != null && !DifficultyEstimator.LEVELS.contains(lvl)) {
            throw ApiException.badRequest("level must be one of " + DifficultyEstimator.LEVELS);
        }
        return new RecommendationFilter(kind, lvl);
    }

    public boolean matches(Text text) {
        return (kind == null || MediaKind.of(text) == kind) && (level == null || level.equals(text.getCefrLevel()));
    }
}
