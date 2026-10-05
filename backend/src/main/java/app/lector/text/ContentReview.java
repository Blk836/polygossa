package app.lector.text;

import app.lector.ai.AiClient;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/**
 * Looks at an import with AI: files it under one of the fixed categories when the importer didn't choose one.
 * Never fails an import: without AI, or with an answer it can't use, the caller's fallback category applies. Not
 * counted against the user's daily AI allowance (the user didn't ask for it).
 */
@Service
public class ContentReview {

    private static final Logger log = LoggerFactory.getLogger(ContentReview.class);

    /** How much of the content the AI sees when picking a category. */
    static final int CATEGORY_EXCERPT = 2_000;

    private static final Map<Category, String> MEANING = Map.ofEntries(
            Map.entry(Category.LEARNERS, "lessons, graded readers and material made for language learners"),
            Map.entry(Category.DAILY_LIFE, "everyday life, conversations, work, family, hobbies, how-to"),
            Map.entry(Category.STORIES, "fiction, fairy tales, novels, poems"),
            Map.entry(Category.NEWS, "news, current affairs, politics, opinion"),
            Map.entry(Category.CULTURE, "art, traditions, society, language and culture"),
            Map.entry(Category.TRAVEL, "travel, places, tourism, geography"),
            Map.entry(Category.FOOD, "food, cooking, recipes, drink"),
            Map.entry(Category.SCIENCE, "science, technology, nature, health"),
            Map.entry(Category.HISTORY, "history and historical figures"),
            Map.entry(Category.ENTERTAINMENT, "films, TV, music, games, sport, celebrities, comedy"),
            Map.entry(Category.OTHER, "anything that fits none of the above"));

    private static final String CATEGORIES = Arrays.stream(Category.values())
            .map(c -> "- " + c.code() + ": " + MEANING.get(c)).collect(Collectors.joining("\n"));

    private final AiClient ai;

    public ContentReview(AiClient ai) {
        this.ai = ai;
    }

    /** The category to file a new import under: the one chosen, else the AI's pick, else {@code fallback}. */
    public Category categoryFor(Category chosen, Text text, Category fallback) {
        if (chosen != null) {
            return chosen;
        }
        return askCategory(text).orElse(fallback);
    }

    private Optional<Category> askCategory(Text text) {
        if (!ai.enabled()) {
            return Optional.empty();
        }
        try {
            JsonNode answer = ai.completeJson(
                    "You file texts for a language-learning library under exactly one category. Categories:\n"
                            + CATEGORIES + "\nReply with JSON: {\"category\": one of the codes above}.",
                    "Language: " + text.getLanguage().displayName() + "\nTitle: " + text.getTitle() + "\n\n"
                            + excerpt(text.getContent(), CATEGORY_EXCERPT),
                    0);
            return Optional.of(Category.parse(answer.path("category").asString("")));
        } catch (RuntimeException e) {
            log.warn("Could not categorise text {} with AI: {}", text.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    static String excerpt(String content, int chars) {
        String c = content == null ? "" : content;
        return c.length() <= chars ? c : c.substring(0, chars);
    }
}
