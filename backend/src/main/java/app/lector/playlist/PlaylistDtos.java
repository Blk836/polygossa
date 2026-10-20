package app.lector.playlist;

import app.lector.text.Category;
import app.lector.text.TextDtos.OwnerDto;
import app.lector.text.TextDtos.TextSummary;
import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

public final class PlaylistDtos {

    private PlaylistDtos() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PlaylistSummary(
            Long id,
            String title,
            String description,
            Language language,
            boolean isPublic,
            OwnerDto owner,
            boolean mine,
            int itemCount,
            int completedCount,
            String thumbnailUrl,
            List<Cover> covers,
            Instant createdAt,
            Instant updatedAt,
            Boolean containsText,
            boolean bookmarked) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Cover(Long textId, String title, String thumbnailUrl, Category category) {}

    public record PlaylistDetail(PlaylistSummary playlist, List<TextSummary> items, int privateItems,
                                 int privateBookItems) {}
}
