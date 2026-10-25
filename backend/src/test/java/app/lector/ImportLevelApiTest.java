package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.book.BookFiles;
import app.lector.seed.SampleContentSeeder;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.UrlImporter;
import app.lector.user.UserRepository;
import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=importlevel",
        "app.seed-samples=true",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0",
        "app.curator-token=level-curator"
})
@AutoConfigureMockMvc
class ImportLevelApiTest {

    private static final String VIDEO = "dQw4w9WgXcQ";
    private static final String CURATED = "CCCCCCCCCCC";
    private static final String SIMPLE = "Le chat mange.";
    private static final String FORMULA_LEVEL = "A1";
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);
    private static List<String> startupReviews;

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

    @Autowired
    TextRepository texts;

    @Autowired
    UserRepository users;

    @MockitoBean
    UrlImporter urlImporter;

    TestApi api;
    String user;

    static List<String> reviews() {
        return AI.requests().stream().filter(r -> r.contains("You review texts")).toList();
    }

    @BeforeEach
    void setUp() throws Exception {
        if (startupReviews == null) {
            startupReviews = reviews();
        }
        AI.reset();
        YOUTUBE.reset();
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola amigos.")));
        YOUTUBE.add(CURATED, YouTubeStub.Video.withCaptions("Le marché", 60, "fr",
                YouTubeStub.srv3("0|2000|Bonjour à tous.")));
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private JsonNode paste(String content, String category, boolean isPublic, int status) throws Exception {
        String cat = category == null ? "" : ",\"category\":\"" + category + "\"";
        return api.post(user, "/api/texts", "{\"title\":\"Le petit chat\",\"language\":\"fr\",\"content\":\""
                + content + "\",\"isPublic\":" + isPublic + cat + "}", status);
    }

    private JsonNode paste(String content) throws Exception {
        return paste(content, null, false, 201);
    }

    private static String level(JsonNode summary) {
        return summary.get("cefrLevel").asString();
    }

    private void askedOnceForTheLevel(String title, String content) {
        assertThat(reviews()).hasSize(1);
        String request = reviews().getFirst();
        assertThat(request).contains(title).contains(content);
        for (String lvl : new String[] {"A1", "A2", "B1", "B2", "C1", "C2"}) {
            assertThat(request).contains(lvl);
        }
    }

    @Test
    void aPastedTextIsLevelledByAi() throws Exception {
        AI.reply("{\"category\":\"food\",\"level\":\"B2\"}");
        assertThat(level(paste(SIMPLE))).isEqualTo("B2");
        askedOnceForTheLevel("Le petit chat", SIMPLE);
    }

    @Test
    void aWebPageIsLevelledByAi() throws Exception {
        when(urlImporter.fetch(anyString())).thenReturn(
                new UrlImporter.Article("Le marché", "On achète des légumes au marché.", "https://example.com/a"));
        AI.reply("{\"category\":\"food\",\"level\":\"B2\"}");
        JsonNode created = api.post(user, "/api/texts/import-url",
                "{\"url\":\"https://example.com/a\",\"language\":\"fr\",\"isPublic\":false}", 201);
        assertThat(level(created)).isEqualTo("B2");
        askedOnceForTheLevel("Le marché", "On achète des légumes");
    }

    @Test
    void aSubtitleFileIsLevelledByAi() throws Exception {
        AI.reply("{\"category\":\"food\",\"level\":\"B2\"}");
        var srt = new MockMultipartFile("file", "cuisine.srt", "text/plain",
                "1\n00:00:01,000 --> 00:00:03,000\nHoy cocinamos paella.\n".getBytes());
        JsonNode created = api.send(multipart("/api/texts/import-subtitles").file(srt).param("language", "es")
                .param("title", "Cocina"), user, 201);
        assertThat(level(created)).isEqualTo("B2");
        askedOnceForTheLevel("Cocina", "Hoy cocinamos paella");
    }

    @Test
    void aYouTubeVideoIsLevelledByAi() throws Exception {
        AI.reply("{\"category\":\"food\",\"level\":\"B2\"}");
        JsonNode created = api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO)
                .param("language", "es"), user, 201);
        assertThat(level(created)).isEqualTo("B2");
        askedOnceForTheLevel("Clase", "Hola amigos");
    }

    @Test
    void aCuratedVideoIsLevelledByAi() throws Exception {
        AI.reply("{\"category\":\"learners\",\"appropriate\":true,\"level\":\"B2\"}");
        var request = MockMvcRequestBuilders.post("/api/curator/videos").contentType(MediaType.APPLICATION_JSON)
                .header("X-Curator-Token", "level-curator")
                .content("{\"url\":\"https://youtu.be/" + CURATED + "\",\"language\":\"fr\",\"dryRun\":false}");
        long id = api.send(request, null, 201).get("id").asLong();
        assertThat(texts.findById(id).map(Text::getCefrLevel).orElseThrow()).isEqualTo("B2");
        askedOnceForTheLevel("Le marché", "Bonjour à tous");
    }

    @Test
    void aChosenCategoryIsKeptAndOnlyTheLevelIsAskedFor() throws Exception {
        AI.reply("{\"category\":\"food\",\"level\":\"C1\"}");
        JsonNode created = paste(SIMPLE, "news", false, 201);
        assertThat(created.get("category").asString()).isEqualTo("news");
        assertThat(level(created)).isEqualTo("C1");
        askedOnceForTheLevel("Le petit chat", SIMPLE);
        assertThat(reviews().getFirst()).doesNotContain("entertainment").doesNotContain("appropriate");
    }

    @Test
    void sharingOnImportAsksForTheLevelInTheSameRequest() throws Exception {
        AI.reply("{\"category\":\"stories\",\"appropriate\":true,\"level\":\"A2\"}");
        JsonNode created = paste(SIMPLE, null, true, 201);
        assertThat(created.get("isPublic").asBoolean()).isTrue();
        assertThat(created.get("category").asString()).isEqualTo("stories");
        assertThat(level(created)).isEqualTo("A2");
        assertThat(reviews()).hasSize(1);
        assertThat(reviews().getFirst()).contains("appropriate").contains("entertainment").contains("C2");
    }

    @Test
    void contentRefusedForSharingIsStillRefused() throws Exception {
        AI.reply("{\"appropriate\":false,\"reason\":\"graphic violence\",\"level\":\"B1\"}");
        JsonNode refused = paste(SIMPLE, null, true, 422);
        assertThat(refused.get("code").asString()).isEqualTo("not_shareable");
        assertThat(api.get(user, "/api/texts", 200).size()).isZero();
    }

    @Test
    void aLowerCaseLevelIsAccepted() throws Exception {
        AI.reply("{\"level\":\" b1 \"}");
        assertThat(level(paste(SIMPLE))).isEqualTo("B1");
    }

    @Test
    void onlyTheStartOfALongPrivateTextIsSent() throws Exception {
        AI.reply("{\"level\":\"C1\"}");
        paste("a".repeat(2_000) + "TAIL" + "b".repeat(48_000), "news", false, 201);
        assertThat(reviews()).hasSize(1);
        assertThat(reviews().getFirst()).contains("a".repeat(2_000)).doesNotContain("TAIL").doesNotContain("bbbb");
    }

    private void theFormulaLevelApplies() throws Exception {
        assertThat(level(paste(SIMPLE))).isEqualTo(FORMULA_LEVEL);
    }

    @Test
    void aLevelWithAPlusFallsBackToTheFormula() throws Exception {
        AI.reply("{\"level\":\"B2+\"}");
        theFormulaLevelApplies();
    }

    @Test
    void aLevelInWordsFallsBackToTheFormula() throws Exception {
        AI.reply("{\"level\":\"intermediate\"}");
        theFormulaLevelApplies();
    }

    @Test
    void noLevelInTheAnswerFallsBackToTheFormula() throws Exception {
        AI.reply("{}");
        theFormulaLevelApplies();
    }

    @Test
    void aFailingAiServiceFallsBackToTheFormula() throws Exception {
        AI.setFailing(true);
        theFormulaLevelApplies();
    }

    @Test
    void anAnswerThatIsNotJsonFallsBackToTheFormula() throws Exception {
        AI.replyRaw("B2, I think");
        theFormulaLevelApplies();
    }

    @Test
    void levellingDoesNotUseTheDailyAllowanceWhichIsUsedUpHere() throws Exception {
        AI.reply("{\"level\":\"C2\"}");
        assertThat(level(paste(SIMPLE))).isEqualTo("C2");
    }

    private JsonNode importBook(Map<String, String> files) throws Exception {
        return api.send(multipart("/api/texts/import-book")
                .file(new MockMultipartFile("file", "viaje.epub", "application/octet-stream",
                        BookFiles.epub("El viaje", files)))
                .param("language", "es"), user, 201);
    }

    private List<String> chapterLevels(JsonNode imported) {
        return imported.get("textIds").valueStream()
                .map(id -> texts.findById(id.asLong()).map(Text::getCefrLevel).orElseThrow()).toList();
    }

    @Test
    void aBookIsLevelledOnceFromItsLongestChapter() throws Exception {
        AI.reply("{\"level\":\"B2\"}");
        Map<String, String> files = new LinkedHashMap<>();
        files.put("toc.xhtml", BookFiles.chapter("Índice", "TOCMARK uno dos tres."));
        for (int i = 1; i <= 11; i++) {
            String body = i == 7 ? "LONGMARK " + "El viaje sigue por el camino largo. ".repeat(40)
                    : "OTHERMARK" + i + " El texto corto.";
            files.put("c" + i + ".xhtml", BookFiles.chapter("Capítulo " + i, body));
        }
        JsonNode imported = importBook(files);
        assertThat(chapterLevels(imported)).hasSize(12).containsOnly("B2");
        assertThat(reviews()).hasSize(1);
        assertThat(reviews().getFirst()).contains("LONGMARK").doesNotContain("TOCMARK").doesNotContain("OTHERMARK");
    }

    @Test
    void aBookWithoutAnAiLevelKeepsEachChaptersFormulaLevel() throws Exception {
        AI.setFailing(true);
        Map<String, String> files = new LinkedHashMap<>();
        for (int i = 1; i <= 3; i++) {
            files.put("c" + i + ".xhtml", BookFiles.chapter("Capítulo " + i, "El gato come."));
        }
        assertThat(chapterLevels(importBook(files))).containsExactly(FORMULA_LEVEL, FORMULA_LEVEL, FORMULA_LEVEL);
    }

    @Test
    void seededSamplesAreNeverSentToTheAi() {
        assertThat(users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL)).isPresent();
        assertThat(startupReviews).isEmpty();
    }

    @Test
    void theLibrarysLevelFilterUsesTheAisLevel() throws Exception {
        AI.reply("{\"category\":\"stories\",\"appropriate\":true,\"level\":\"B2\"}");
        long id = paste(SIMPLE, null, true, 201).get("id").asLong();
        JsonNode page = api.get(user, "/api/library?language=fr&level=B2&size=50", 200);
        assertThat(page.get("items").valueStream().map(i -> i.get("id").asLong())).contains(id);
    }
}
