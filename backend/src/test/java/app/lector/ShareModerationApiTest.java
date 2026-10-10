package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.text.UrlImporter;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=sharemoderation",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0"
})
@AutoConfigureMockMvc
class ShareModerationApiTest {

    private static final String VIDEO = "dQw4w9WgXcQ";
    private static final String QUESTION = "appropriate";
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

    @MockitoBean
    UrlImporter urlImporter;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        YOUTUBE.reset();
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola amigos.")));
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private String pasteBody(String content, boolean isPublic, String category) {
        String cat = category == null ? "" : ",\"category\":\"" + category + "\"";
        return "{\"title\":\"Titre\",\"language\":\"fr\",\"content\":\"" + content + "\",\"isPublic\":" + isPublic + cat + "}";
    }

    private JsonNode paste(boolean isPublic, String category, int status) throws Exception {
        return api.post(user, "/api/texts", pasteBody("Bonjour à tous.", isPublic, category), status);
    }

    private int libraryCount() throws Exception {
        return api.get(user, "/api/texts", 200).size();
    }

    private int importsUsed() throws Exception {
        return api.get(user, "/api/me", 200).get("plan").get("usage").get("texts").asInt();
    }

    private void askedOnceIfAppropriate() {
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().get(0)).contains(QUESTION);
    }

    private static void sharedAsFood(JsonNode created) {
        assertThat(created.get("isPublic").asBoolean()).isTrue();
        assertThat(created.get("category").asString()).isEqualTo("food");
    }

    @Test
    void aSharedPastedTextThatPassesIsShared() throws Exception {
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        sharedAsFood(paste(true, null, 201));
        askedOnceIfAppropriate();
    }

    @Test
    void aSharedWebPageThatPassesIsShared() throws Exception {
        when(urlImporter.fetch(anyString())).thenReturn(
                new UrlImporter.Article("Le marché", "On achète des légumes.", "https://example.com/a"));
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        sharedAsFood(api.post(user, "/api/texts/import-url",
                "{\"url\":\"https://example.com/a\",\"language\":\"fr\",\"isPublic\":true}", 201));
        askedOnceIfAppropriate();
    }

    @Test
    void aSharedSubtitleFileThatPassesIsShared() throws Exception {
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        var srt = new MockMultipartFile("file", "c.srt", "text/plain",
                "1\n00:00:01,000 --> 00:00:03,000\nHoy cocinamos.\n".getBytes());
        sharedAsFood(api.send(multipart("/api/texts/import-subtitles").file(srt).param("language", "es")
                .param("isPublic", "true"), user, 201));
        askedOnceIfAppropriate();
    }

    @Test
    void aSharedYouTubeVideoThatPassesIsShared() throws Exception {
        AI.reply("{\"appropriate\":true,\"category\":\"food\"}");
        sharedAsFood(api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO)
                .param("language", "es").param("isPublic", "true"), user, 201));
        askedOnceIfAppropriate();
    }

    @Test
    void aChosenCategoryIsKeptAndTheImportIsStillChecked() throws Exception {
        AI.reply("{\"appropriate\":true}");
        JsonNode created = paste(true, "news", 201);
        assertThat(created.get("isPublic").asBoolean()).isTrue();
        assertThat(created.get("category").asString()).isEqualTo("news");
        askedOnceIfAppropriate();
    }

    @Test
    void aSharedImportThatFailsIsRefusedAndNothingIsSaved() throws Exception {
        int before = libraryCount();
        int used = importsUsed();
        AI.reply("{\"appropriate\":false,\"reason\":\"Graphic violence\"}");
        JsonNode error = paste(true, null, 422);
        assertThat(error.get("code").asString()).isEqualTo("not_shareable");
        assertThat(error.get("message").asString()).contains("can't be shared").contains("Graphic violence")
                .contains("without sharing");
        assertThat(libraryCount()).isEqualTo(before);
        assertThat(importsUsed()).isEqualTo(used);
    }

    @Test
    void aPrivateImportIsNotChecked() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        paste(false, null, 201);
        assertThat(AI.requests()).hasSize(1);
        assertThat(AI.requests().get(0)).doesNotContain(QUESTION);
        paste(false, "news", 201);
        assertThat(AI.requests()).hasSize(1);
    }

    @Test
    void theCheckSeesTheFirst8000Characters() throws Exception {
        AI.reply("{\"appropriate\":true,\"category\":\"stories\"}");
        String content = "a".repeat(8_000) + "TAIL" + "b".repeat(42_000);
        api.post(user, "/api/texts", pasteBody(content, true, null), 201);
        assertThat(AI.requests().get(0)).contains("a".repeat(8_000)).doesNotContain("TAIL").doesNotContain("bbbb");
    }

    @Test
    void sharingAPrivateTextLaterIsChecked() throws Exception {
        long id = paste(false, "news", 201).get("id").asLong();
        AI.reply("{\"appropriate\":false,\"reason\":\"Hate speech\"}");
        JsonNode error = api.patch(user, "/api/texts/" + id, "{\"isPublic\":true}", 422);
        assertThat(error.get("code").asString()).isEqualTo("not_shareable");
        assertThat(error.get("message").asString()).contains("Hate speech");
        assertThat(api.get(user, "/api/texts/" + id, 200).get("text").get("isPublic").asBoolean()).isFalse();
        AI.reply("{\"appropriate\":true}");
        assertThat(api.patch(user, "/api/texts/" + id, "{\"isPublic\":true}", 200).get("isPublic").asBoolean()).isTrue();
    }

    @Test
    void changesThatShareNothingAreNotChecked() throws Exception {
        AI.reply("{\"appropriate\":true}");
        long id = paste(true, "news", 201).get("id").asLong();
        AI.reset();
        api.patch(user, "/api/texts/" + id, "{\"title\":\"Nouveau\"}", 200);
        api.patch(user, "/api/texts/" + id, "{\"isPublic\":true}", 200);
        api.patch(user, "/api/texts/" + id, "{\"isPublic\":false}", 200);
        assertThat(AI.requests()).isEmpty();
    }

    private void sharingIsRefusedButPrivateImportsWork() throws Exception {
        int before = libraryCount();
        JsonNode error = paste(true, null, 503);
        assertThat(error.get("code").asString()).isEqualTo("review_unavailable");
        assertThat(error.get("message").asString()).contains("try again").contains("without sharing");
        assertThat(libraryCount()).isEqualTo(before);
        paste(false, null, 201);
    }

    @Test
    void aFailingAiServiceRefusesSharing() throws Exception {
        AI.setFailing(true);
        sharingIsRefusedButPrivateImportsWork();
    }

    @Test
    void anUnreadableAnswerRefusesSharing() throws Exception {
        AI.replyRaw("looks fine");
        sharingIsRefusedButPrivateImportsWork();
    }

    @Test
    void anAnswerWithoutAVerdictRefusesSharing() throws Exception {
        AI.reply("{\"category\":\"food\"}");
        sharingIsRefusedButPrivateImportsWork();
    }
}
