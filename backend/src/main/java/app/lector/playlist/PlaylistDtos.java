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

    /**
     * A playlist as the viewer sees it: {@code itemCount} and {@code completedCount} count only the items they can
     * read; {@code thumbnailUrl} is the first such video's and {@code covers} the first few such items;
     * {@code containsText} answers {@code ?textId=} on lists; {@code bookmarked}: the viewer saved it.
     */
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

    /** One of the first items, drawn as a card in the playlist's deck: its video thumbnail, or its category's cover. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Cover(Long textId, String title, String thumbnailUrl, Category category) {}

    /** The items the viewer can read, in order; {@code privateItems}: how many of the owner's items others can't see. */
    public record PlaylistDetail(PlaylistSummary playlist, List<TextSummary> items, int privateItems) {}
}
