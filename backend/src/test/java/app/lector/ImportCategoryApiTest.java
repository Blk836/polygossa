package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.text.UrlImporter;
import app.lector.token.Language;
import app.lector.user.UserRepository;
import app.lector.video.VideoImportService;
import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: imports are filed under a category by AI (docs/acceptance/auto-category.feature). The daily AI allowance
 * is 0 here, to show that categorising doesn't use it.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:importcategory;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0"
})
@AutoConfigureMockMvc
class ImportCategoryApiTest {

    private static final String VIDEO = "dQw4w9WgXcQ";
    private static final OpenAiStub AI = start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = start(YouTubeStub::new);

    interface Starter<T> {
        T start() throws java.io.IOException;
    }

    static <T> T start(Starter<T> starter) {
        try {
            return starter.start();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

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

    @MockitoBean
    UrlImporter urlImporter;

    @Autowired
    VideoImportService videos;

    @Autowired
    UserRepository users;

    @Autowired
    TransactionTemplate tx;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        YOUTUBE.reset();
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola amigos.")));
        YOUTUBE.setCategory(VIDEO, "Education");
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private JsonNode paste(String content, String category) throws Exception {
        String cat = category == null ? "" : ",\"category\":\"" + category + "\"";
        return api.post(user, "/api/texts", "{\"title\":\"Recette du pain\",\"language\":\"fr\",\"content\":\""
                + content + "\",\"isPublic\":false" + cat + "}", 201);
    }

    private JsonNode importVideo() throws Exception {
        return api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO)
                .param("language", "es"), user, 201);
    }

    /** The one request the AI got: it names the title, the content's start and every category code. */
    private void askedOnceAbout(String title, String content) {
        assertThat(AI.requests()).hasSize(1);
        String request = AI.requests().get(0);
        assertThat(request).contains(title).contains(content);
        for (String code : new String[] {"learners", "daily-life", "stories", "news", "culture", "travel", "food",
                "science", "history", "entertainment", "other"}) {
            assertThat(request).contains(code);
        }
    }

    // ---- each kind of import ----

    @Test
    void aPastedTextIsCategorisedByAi() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        assertThat(paste("Mélangez la farine et l'eau.", null).get("category").asString()).isEqualTo("food");
        askedOnceAbout("Recette du pain", "Mélangez la farine");
    }

    @Test
    void aWebPageIsCategorisedByAi() throws Exception {
        when(urlImporter.fetch(anyString())).thenReturn(
                new UrlImporter.Article("Le marché", "On achète des légumes au marché.", "https://example.com/a"));
        AI.reply("{\"category\":\"food\"}");
        JsonNode created = api.post(user, "/api/texts/import-url",
                "{\"url\":\"https://example.com/a\",\"language\":\"fr\",\"isPublic\":false}", 201);
        assertThat(created.get("category").asString()).isEqualTo("food");
        askedOnceAbout("Le marché", "On achète des légumes");
    }

    @Test
    void aSubtitleFileIsCategorisedByAi() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        var srt = new MockMultipartFile("file", "cuisine.srt", "text/plain",
                "1\n00:00:01,000 --> 00:00:03,000\nHoy cocinamos paella.\n".getBytes());
        JsonNode created = api.send(multipart("/api/texts/import-subtitles").file(srt).param("language", "es")
                .param("title", "Cocina"), user, 201);
        assertThat(created.get("category").asString()).isEqualTo("food");
        askedOnceAbout("Cocina", "Hoy cocinamos paella");
    }

    @Test
    void aYouTubeVideoIsCategorisedByAiRatherThanByYouTube() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        assertThat(importVideo().get("category").asString()).isEqualTo("food");
        askedOnceAbout("Clase", "Hola amigos");
    }

    // ---- when the AI isn't asked or can't help ----

    @Test
    void aChosenCategoryIsKeptWithoutAskingTheAi() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        assertThat(paste("Les nouvelles du jour.", "news").get("category").asString()).isEqualTo("news");
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void onlyTheStartOfALongTextIsSent() throws Exception {
        AI.reply("{\"category\":\"stories\"}");
        String content = "a".repeat(2_000) + "TAIL" + "b".repeat(48_000);
        paste(content, null);
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().get(0)).contains("a".repeat(2_000)).doesNotContain("TAIL").doesNotContain("bbbb");
    }

    private void unusableAnswerFallsBack() throws Exception {
        assertThat(paste("Bonjour.", null).get("category").asString()).isEqualTo("other");
        assertThat(importVideo().get("category").asString()).isEqualTo("learners");
    }

    @Test
    void anUnknownCategoryFallsBackToTheOldDefault() throws Exception {
        AI.reply("{\"category\":\"cooking\"}");
        unusableAnswerFallsBack();
    }

    @Test
    void noCategoryInTheAnswerFallsBack() throws Exception {
        AI.reply("{}");
        unusableAnswerFallsBack();
    }

    @Test
    void aFailingAiServiceFallsBack() throws Exception {
        AI.setFailing(true);
        unusableAnswerFallsBack();
    }

    @Test
    void anAnswerThatIsNotJsonFallsBack() throws Exception {
        AI.replyRaw("food, I think");
        unusableAnswerFallsBack();
    }

    @Test
    void seededSampleVideosAreNotSentToTheAi() {
        var owner = users.findAll().getFirst();
        tx.executeWithoutResult(s -> videos.importUnchecked(owner, new VideoImportService.VideoImport(
                "https://youtu.be/" + VIDEO, Language.ES, null, true, null, null, null)));
        assertThat(AI.requests()).isEmpty();
    }
}
