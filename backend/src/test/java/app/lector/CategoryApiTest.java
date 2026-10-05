package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import app.lector.text.Category;
import app.lector.video.YouTubeStub;
import jakarta.persistence.EntityManagerFactory;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Feature: texts and videos are filed under a small set of categories, and Explore shows them as shelves. */
@YouTubeApiTest
class CategoryApiTest {

    private static final String VIDEO = "dQw4w9WgXcQ";
    private static final YouTubeStub STUB = YouTubeApiTest.STUB;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        STUB.reset();
        STUB.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola amigos.")));
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private long create(String token, String lang, String category, boolean isPublic) throws Exception {
        String cat = category == null ? "" : ",\"category\":\"" + category + "\"";
        return api.post(token, "/api/texts", "{\"title\":\"T\",\"language\":\"" + lang + "\",\"content\":\"Uno dos.\","
                + "\"isPublic\":" + isPublic + cat + "}", 201).get("id").asLong();
    }

    private JsonNode summary(long id) throws Exception {
        return api.get(user, "/api/texts/" + id, 200).get("text");
    }

    private static List<String> field(JsonNode list, String name) {
        List<String> out = new ArrayList<>();
        list.forEach(n -> out.add(n.get(name).asString()));
        return out;
    }

    // ---- assigning a category ----

    @Test
    void newTextKeepsTheChosenCategory() throws Exception {
        assertThat(summary(create(user, "es", "food", false)).get("category").asString()).isEqualTo("food");
    }

    @Test
    void textWithoutACategoryIsOther() throws Exception {
        assertThat(summary(create(user, "es", null, false)).get("category").asString()).isEqualTo("other");
    }

    @Test
    void unknownCategoryIsRejected() throws Exception {
        api.post(user, "/api/texts", "{\"title\":\"T\",\"language\":\"es\",\"content\":\"Uno.\",\"category\":\"sports\"}", 400);
    }

    @Test
    void ownerCanRecategorise() throws Exception {
        long id = create(user, "es", null, false);
        JsonNode updated = api.send(patch("/api/texts/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"category\":\"travel\"}"), user, 200);
        assertThat(updated.get("category").asString()).isEqualTo("travel");
        assertThat(updated.get("title").asString()).isEqualTo("T");
        assertThat(summary(id).get("category").asString()).isEqualTo("travel");
    }

    @Test
    void othersCannotRecategorise() throws Exception {
        String other = api.signupPro();
        long id = create(other, "es", "food", true);
        api.send(patch("/api/texts/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"news\"}"), user, 403);
        assertThat(api.get(other, "/api/texts/" + id, 200).get("text").get("category").asString()).isEqualTo("food");
    }

    @Test
    void patchWithoutCategoryLeavesItAlone() throws Exception {
        long id = create(user, "es", "food", false);
        api.send(patch("/api/texts/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"New\"}"), user, 200);
        assertThat(summary(id).get("category").asString()).isEqualTo("food");
    }

    // ---- YouTube imports ----

    private JsonNode importVideo(String category) throws Exception {
        var req = multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO).param("language", "es");
        if (category != null) {
            req.param("category", category);
        }
        return api.send(req, user, 201);
    }

    @Test
    void youtubeVideosAreFiledFromYouTubesOwnCategory() throws Exception {
        STUB.setCategory(VIDEO, "Education");
        assertThat(importVideo(null).get("category").asString()).isEqualTo("learners");
    }

    @Test
    void aChosenCategoryBeatsYouTubes() throws Exception {
        STUB.setCategory(VIDEO, "Education");
        assertThat(importVideo("food").get("category").asString()).isEqualTo("food");
    }

    @Test
    void videosWithAnUnmappedOrMissingYouTubeCategoryAreOther() throws Exception {
        STUB.setCategory(VIDEO, "Autos & Vehicles");
        assertThat(importVideo(null).get("category").asString()).isEqualTo("other");
        STUB.reset();
        STUB.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola amigos.")));
        assertThat(importVideo(null).get("category").asString()).isEqualTo("other");
    }

    // ---- browsing ----

    @Test
    void exploreFiltersByCategory() throws Exception {
        String author = api.signupPro();
        create(author, "it", "food", true);
        create(author, "it", "news", true);
        create(author, "it", null, true);
        assertThat(field(api.get(user, "/api/library?language=it&category=food", 200).get("items"), "category"))
                .containsExactly("food");
        assertThat(field(api.get(user, "/api/library?language=it&category=other", 200).get("items"), "category"))
                .containsExactly("other");
        assertThat(api.get(user, "/api/library?language=it", 200).get("total").asInt()).isEqualTo(3);
        api.get(user, "/api/library?category=sports", 400);
    }

    @Test
    void myLibraryFiltersByCategory() throws Exception {
        create(user, "es", "food", false);
        create(user, "es", "news", false);
        assertThat(field(api.get(user, "/api/texts?language=es&category=news", 200), "category")).containsExactly("news");
    }

    @Test
    void shelvesGroupPublicContentByCategoryInAFixedOrder() throws Exception {
        String author = api.signupPro();
        for (int i = 0; i < 10; i++) {
            create(author, "pt", "food", true);
        }
        create(author, "pt", "stories", true);
        create(author, "pt", null, true);
        create(author, "pt", "learners", false); // private: not on any shelf
        create(author, "de", "news", true); // other language

        JsonNode shelves = api.get(user, "/api/library/shelves?language=pt", 200);
        assertThat(field(shelves, "category")).containsExactly("stories", "food", "other");
        JsonNode food = shelves.get(1);
        assertThat(food.get("total").asInt()).isEqualTo(10);
        assertThat(food.get("items")).hasSize(8);
        assertThat(field(food.get("items"), "category")).containsOnly("food");
        assertThat(food.get("items").get(0).get("id").asLong()).isGreaterThan(food.get("items").get(7).get("id").asLong());
    }

    @Test
    void shelvesHonourLevelAndKindFilters() throws Exception {
        String author = api.signupPro();
        create(author, "ko", "food", true);
        assertThat(api.get(user, "/api/library/shelves?language=ko&kind=video", 200)).isEmpty();
        assertThat(api.get(user, "/api/library/shelves?language=ko&kind=text", 200)).hasSize(1);
        assertThat(api.get(user, "/api/library/shelves?language=ko&level=C2", 200)).isEmpty();
        api.get(user, "/api/library/shelves?level=Z9", 400);
    }

    @Test
    void shelvesDoNotRunAQueryPerCategory() throws Exception {
        String author = api.signupPro();
        for (Category category : Category.values()) {
            create(author, "it", category.code(), true);
        }
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        JsonNode shelves = api.get(user, "/api/library/shelves?language=it", 200);
        assertThat(shelves).hasSize(Category.values().length);
        // Every public row is read in full to test the filters (H2 keeps the text inline), so a query per category
        // re-read them all: Explore's front page took seconds once there were a few long transcripts.
        assertThat(stats.getQueryExecutionCount()).isLessThan(Category.values().length);
    }

    @Test
    void shelvesShowViewerStatsAndReactions() throws Exception {
        String author = api.signupPro();
        create(author, "zh", "culture", true);
        JsonNode item = api.get(user, "/api/library/shelves?language=zh", 200).get(0).get("items").get(0);
        assertThat(item.has("stats")).isTrue();
        assertThat(item.get("likes").asLong()).isZero();
        assertThat(item.get("bookmarked").asBoolean()).isFalse();
    }
}
