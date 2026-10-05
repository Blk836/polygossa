package app.lector.recommend;

import app.lector.TestApi;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import tools.jackson.databind.JsonNode;

/**
 * Builds Explore data for recommendation tests: a learner who knows {@link #KNOWN} French words, and public texts by
 * other learners whose known-word share is set by how many unknown words they mix in.
 */
final class RecommendFixture {

    static final int KNOWN = 30;
    private static final AtomicInteger UNKNOWN = new AtomicInteger();

    private final TestApi api;
    /** Texts made through this fixture and their owners, deleted by {@link #cleanUp}. */
    private final java.util.Map<Long, String> created = new java.util.LinkedHashMap<>();

    RecommendFixture(TestApi api) {
        this.api = api;
    }

    static String letters(int n) {
        return "" + (char) ('a' + n / 676 % 26) + (char) ('a' + n / 26 % 26) + (char) ('a' + n % 26);
    }

    /** Marks the fixture's known words known for this learner. */
    void learnWords(String learner) throws Exception {
        for (int i = 0; i < KNOWN; i++) {
            api.post(learner, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"k" + letters(i)
                    + "\",\"status\":\"known\"}", 201);
        }
    }

    /** Content with {@code known} of the learner's known words and {@code unknown} words nobody knows. */
    static String content(int known, int unknown) {
        List<String> words = new ArrayList<>();
        for (int i = 0; i < known; i++) {
            words.add("k" + letters(i));
        }
        for (int i = 0; i < unknown; i++) {
            words.add("u" + letters(UNKNOWN.getAndIncrement()));
        }
        return String.join(" ", words) + ".";
    }

    /** A text where the learner knows {@code known} of {@code known + unknown} distinct words. */
    long text(String owner, String title, String category, int known, int unknown, boolean isPublic) throws Exception {
        return text(owner, title, "fr", category, content(known, unknown), isPublic);
    }

    long text(String owner, String title, String language, String category, String content, boolean isPublic)
            throws Exception {
        long id = api.post(owner, "/api/texts", "{\"title\":\"" + title + "\",\"language\":\"" + language
                + "\",\"content\":\"" + content + "\",\"isPublic\":" + isPublic + ",\"category\":\"" + category + "\"}",
                201).get("id").asLong();
        created.put(id, owner);
        return id;
    }

    /** The test deleted this text itself. */
    void forget(long id) {
        created.remove(id);
    }

    /** Deletes the texts made here, so the next test starts from an empty library. */
    void cleanUp() throws Exception {
        for (var e : created.entrySet()) {
            api.delete(e.getValue(), "/api/texts/" + e.getKey(), 204);
        }
        created.clear();
    }

    /** A public French text at 95% known (19 of 20 words). */
    long publicText(String owner, String title, String category) throws Exception {
        return text(owner, title, category, 19, 1, true);
    }

    JsonNode recommendations(String learner) throws Exception {
        return api.get(learner, "/api/recommendations?language=fr", 200);
    }

    static JsonNode shelf(JsonNode recommendations, String id) {
        for (JsonNode shelf : recommendations.get("shelves")) {
            if (shelf.get("id").asString().equals(id)) {
                return shelf;
            }
        }
        return null;
    }

    static List<Long> ids(JsonNode shelf) {
        List<Long> ids = new ArrayList<>();
        if (shelf != null) {
            for (JsonNode item : shelf.get("items")) {
                ids.add(item.get("text").get("id").asLong());
            }
        }
        return ids;
    }

    static List<String> shelfIds(JsonNode recommendations) {
        List<String> ids = new ArrayList<>();
        recommendations.get("shelves").forEach(s -> ids.add(s.get("id").asString()));
        return ids;
    }

    static JsonNode reasonOf(JsonNode shelf, long textId) {
        for (JsonNode item : shelf.get("items")) {
            if (item.get("text").get("id").asLong() == textId) {
                return item.get("reason");
            }
        }
        return null;
    }
}
