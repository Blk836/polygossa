package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Bulk-imported videos go through the same AI category and sharing check as a shared Library import. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:curatedreview;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.curator-token=" + CuratedVideoImportApiTest.TOKEN,
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s"
})
@AutoConfigureMockMvc
class CuratedVideoReviewApiTest {

    private static final String VIDEO = "AAAAAAAAAAA";
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.openai.base-url", AI::baseUrl);
        registry.add("app.youtube.base-url", YOUTUBE::baseUrl);
    }

    @AfterAll
    static void stop() {
        AI.close();
        YOUTUBE.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;

    @BeforeEach
    void setUp() {
        AI.reset();
        YOUTUBE.reset();
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Le marché", 60, "fr", YouTubeStub.srv3("0|2000|Bonjour à tous.")));
        YOUTUBE.setCategory(VIDEO, "Education");
        api = new TestApi(mvc, json);
    }

    private JsonNode curate(int status) throws Exception {
        return api.send(MockMvcRequestBuilders.post("/api/curator/videos").contentType(MediaType.APPLICATION_JSON)
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN)
                .content(CuratedVideoImportApiTest.body("https://youtu.be/" + VIDEO, "fr", null, false)), null, status);
    }

    private long publicVideos() throws Exception {
        return api.get(api.signup(), "/api/library?kind=video&size=50", 200).get("total").asLong();
    }

    @Test
    void theAiFilesItAndChecksItCanBeShared() throws Exception {
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        assertThat(curate(201).get("category").asString()).isEqualTo("food");
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().getFirst()).contains("appropriate");
    }

    @Test
    void aVideoTheAiFindsInappropriateIsRefusedWithTheReason() throws Exception {
        AI.reply("{\"appropriate\":false,\"reason\":\"Graphic violence\"}");
        JsonNode r = curate(422);
        assertThat(r.get("code").asString()).isEqualTo("not_shareable");
        assertThat(r.get("message").asString()).contains("Graphic violence");
        assertThat(publicVideos()).isZero();
    }

    @Test
    void aVideoThatCannotBeCheckedIsNotSavedSoARetryCanImportIt() throws Exception {
        AI.setFailing(true);
        assertThat(curate(503).get("code").asString()).isEqualTo("review_unavailable");
        assertThat(publicVideos()).isZero();

        AI.setFailing(false);
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        assertThat(curate(201).get("outcome").asString()).isEqualTo("imported");
    }
}
