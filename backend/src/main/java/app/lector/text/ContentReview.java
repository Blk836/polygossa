package app.lector.text;

import app.lector.ai.AiClient;
import app.lector.ai.AiJob;
import app.lector.common.ApiException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class ContentReview {

    private static final Logger log = LoggerFactory.getLogger(ContentReview.class);

    static final int CATEGORY_EXCERPT = 2_000;
    static final int MODERATION_EXCERPT = 8_000;

    static final String AFTER_IMPORT_REFUSED = "Import it without sharing to read it yourself.";
    static final String AFTER_SHARE_REFUSED = "It stays private in your library.";

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

    private static final String RULES = "Decide whether it is appropriate to share with every learner in a public "
            + "library. Not appropriate: sexually explicit content, graphic violence or gore, hate speech or "
            + "harassment, encouraging self-harm or crime, spam or scams, private people's personal data. News, "
            + "history and fiction that deal with hard subjects are fine.";

    private final AiClient ai;

    public ContentReview(AiClient ai) {
        this.ai = ai;
    }

    public Category reviewImport(Category chosen, Text text, Category fallback) {
        boolean categorise = chosen == null;
        boolean moderate = text.isPublic();
        if (!ai.enabled() || !(categorise || moderate)) {
            return categorise ? fallback : chosen;
        }
        Optional<JsonNode> answer = ask(text, categorise, moderate);
        if (moderate) {
            requireShareable(answer, AFTER_IMPORT_REFUSED);
        }
        return categorise ? answer.flatMap(ContentReview::category).orElse(fallback) : chosen;
    }

    public void checkSharing(Text text) {
        if (text.isPublic() || !ai.enabled()) {
            return;
        }
        requireShareable(ask(text, false, true), AFTER_SHARE_REFUSED);
    }

    private Optional<JsonNode> ask(Text text, boolean categorise, boolean moderate) {
        try {
            return Optional.of(ai.completeJson(AiJob.CONTENT_REVIEW, prompt(categorise, moderate),
                    "Language: " + text.getLanguage().displayName() + "\nTitle: " + text.getTitle() + "\n\n"
                            + excerpt(text.getContent(), moderate ? MODERATION_EXCERPT : CATEGORY_EXCERPT),
                    0));
        } catch (RuntimeException e) {
            log.warn("Could not review text {} with AI: {}", text.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    static String prompt(boolean categorise, boolean moderate) {
        StringBuilder system = new StringBuilder("You review texts for a language-learning library.");
        List<String> fields = new ArrayList<>();
        if (categorise) {
            system.append(" File the text under exactly one category:\n").append(CATEGORIES).append('\n');
            fields.add("\"category\": one of the codes above");
        }
        if (moderate) {
            system.append(' ').append(RULES);
            fields.add("\"appropriate\": boolean, \"reason\": short English reason when not appropriate");
        }
        return system.append(" Reply with JSON: {").append(String.join(", ", fields)).append("}.").toString();
    }

    private static Optional<Category> category(JsonNode answer) {
        try {
            return Optional.of(Category.parse(answer.path("category").asString("")));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static void requireShareable(Optional<JsonNode> answer, String afterRefusal) {
        JsonNode verdict = answer.map(a -> a.path("appropriate")).filter(JsonNode::isBoolean)
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "review_unavailable",
                        "We couldn't check this content for sharing right now; try again, or import it without sharing."));
        if (!verdict.asBoolean()) {
            String reason = answer.get().path("reason").asString("").strip().replaceAll("[.\\s]+$", "");
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "not_shareable",
                    "This can't be shared in the community library" + (reason.isEmpty() ? "" : ": " + reason)
                            + ". " + afterRefusal);
        }
    }

    static String excerpt(String content, int chars) {
        String c = content == null ? "" : content;
        return c.length() <= chars ? c : c.substring(0, chars);
    }
}
