package app.lector.recommend;

import app.lector.text.Category;
import app.lector.text.TextDtos.TextSummary;
import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Recommendations(Language language, List<Shelf> shelves) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Shelf(ShelfId id, String topic, Category category, Anchor anchor, List<Item> items) {}

    public record Anchor(Long id, String title, boolean liked) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Item(TextSummary text, Reason reason, ScoreParts parts) {}
}
