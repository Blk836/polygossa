package app.lector.recommend;

import app.lector.text.Category;
import app.lector.text.TextDtos.TextSummary;
import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Explore's personalised shelves, in order; empty shelves are left out. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Recommendations(Language language, List<Shelf> shelves) {

    /** One shelf: "topic" names its topic or category, "because" its anchor. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Shelf(ShelfId id, String topic, Category category, Anchor anchor, List<Item> items) {}

    /** The text "Because you read / liked …" refers to. */
    public record Anchor(Long id, String title, boolean liked) {}

    public record Item(TextSummary text, Reason reason) {}
}
