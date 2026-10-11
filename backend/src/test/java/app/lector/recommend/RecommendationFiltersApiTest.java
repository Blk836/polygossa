package app.lector.recommend;

import static app.lector.recommend.RecommendFixture.ids;
import static app.lector.recommend.RecommendFixture.shelf;
import static app.lector.recommend.RecommendFixture.shelfIds;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.text.TextRepository;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=recfilters",
        "app.seed-samples=false"
})
@AutoConfigureMockMvc
class RecommendationFiltersApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    @Autowired
    TransactionTemplate tx;

    TestApi api;
    RecommendFixture fx;
    String learner;
    String author;
    long text;
    long video;
    long startedText;
    long startedVideo;

    @AfterEach
    void deleteTexts() throws Exception {
        fx.cleanUp();
    }

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        fx = new RecommendFixture(api);
        learner = api.signupPro();
        author = api.signupPro();
        fx.learnWords(learner);
        text = fx.publicText(author, "Un texte", "food");
        video = videoOf(fx.publicText(author, "Une vidéo", "food"), "B1");
        startedText = fx.publicText(author, "Texte commencé", "news");
        startedVideo = videoOf(fx.publicText(author, "Vidéo commencée", "news"), "B1");
        level(text, "A2");
        level(startedText, "A2");
        progress(startedText);
        progress(startedVideo);
    }

    private long videoOf(long id, String level) {
        tx.executeWithoutResult(s -> texts.findById(id).ifPresent(t -> {
            t.setVideo("vid" + id, 60);
            t.setCefrLevel(level);
        }));
        return id;
    }

    private void level(long id, String level) {
        tx.executeWithoutResult(s -> texts.findById(id).ifPresent(t -> t.setCefrLevel(level)));
    }

    private void progress(long id) throws Exception {
        api.post(learner, "/api/texts/" + id + "/progress", "{\"position\":5}", 200);
    }

    private JsonNode recommendations(String query) throws Exception {
        return api.get(learner, "/api/recommendations?language=fr" + query, 200);
    }

    private static List<Long> everyShown(JsonNode recs) {
        List<Long> all = new ArrayList<>();
        recs.get("shelves").forEach(s -> all.addAll(ids(s)));
        return all;
    }

    @Test
    void withoutFiltersTextsAndVideosAreBothRecommended() throws Exception {
        JsonNode recs = recommendations("");
        assertThat(everyShown(recs)).contains(text, video, startedText, startedVideo);
    }

    @Test
    void textsOnlyLeavesEveryVideoOutOfEveryRow() throws Exception {
        JsonNode recs = recommendations("&kind=text");
        assertThat(everyShown(recs)).contains(text, startedText).doesNotContain(video, startedVideo);
        assertThat(ids(shelf(recs, "continue"))).containsExactly(startedText);
    }

    @Test
    void videosOnlyLeavesEveryTextOutOfEveryRow() throws Exception {
        JsonNode recs = recommendations("&kind=video");
        assertThat(everyShown(recs)).contains(video, startedVideo).doesNotContain(text, startedText);
        assertThat(ids(shelf(recs, "continue"))).containsExactly(startedVideo);
    }

    @Test
    void aLevelLeavesOtherLevelsOutOfEveryRow() throws Exception {
        JsonNode recs = recommendations("&level=b1");
        assertThat(everyShown(recs)).contains(video, startedVideo).doesNotContain(text, startedText);
    }

    @Test
    void aRowWithNothingLeftIsNotShown() throws Exception {
        api.post(learner, "/api/texts/" + startedVideo + "/complete", "", 200);
        assertThat(shelfIds(recommendations("&kind=video"))).doesNotContain("continue");
    }

    @Test
    void anUnknownKindOrLevelIsRefused() throws Exception {
        api.get(learner, "/api/recommendations?language=fr&kind=podcast", 400);
        api.get(learner, "/api/recommendations?language=fr&level=Z9", 400);
    }
}
