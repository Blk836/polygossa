package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.seed.SampleContentSeeder;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.user.UserRepository;
import app.lector.video.YouTubeStub;
import java.util.List;
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
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: bulk-importing curated YouTube videos (docs/acceptance/bulk-video-import.feature), the backend side: the
 * curator endpoint the tools/ importer calls. No AI here, so videos are filed by YouTube's own category.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:curatedvideos;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.curator-token=" + CuratedVideoImportApiTest.TOKEN,
        "app.billing.enforce-limits=true",
        "app.billing.free-text-limit=2"
})
@AutoConfigureMockMvc
class CuratedVideoImportApiTest {

    static final String TOKEN = "curator-secret";
    static final String HEADER = "X-Curator-Token";
    private static final String FR = "AAAAAAAAAAA";
    private static final String ES = "BBBBBBBBBBB";
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.youtube.base-url", YOUTUBE::baseUrl);
    }

    @AfterAll
    static void stop() {
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

    @Autowired
    TransactionTemplate tx;

    TestApi api;

    @BeforeEach
    void setUp() {
        YOUTUBE.reset();
        YOUTUBE.add(FR, YouTubeStub.Video.withCaptions("Le marché", 60, "fr", YouTubeStub.srv3("0|2000|Bonjour à tous.")));
        YOUTUBE.setCategory(FR, "Education");
        YOUTUBE.add(ES, YouTubeStub.Video.withCaptions("La cocina", 90, "es", YouTubeStub.srv3("0|3000|Hola amigos.")));
        api = new TestApi(mvc, json);
        tx.executeWithoutResult(s -> libraryVideos().forEach(texts::delete));
    }

    static String body(String url, String language, String category, boolean dryRun) {
        return "{\"url\":\"" + url + "\"" + (language == null ? "" : ",\"language\":\"" + language + "\"")
                + (category == null ? "" : ",\"category\":\"" + category + "\"") + ",\"dryRun\":" + dryRun + "}";
    }

    private JsonNode curate(String token, String body, int status) throws Exception {
        var request = MockMvcRequestBuilders.post("/api/curator/videos").contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) {
            request.header(HEADER, token);
        }
        return api.send(request, null, status);
    }

    private JsonNode curate(String url, String language, String category, int status) throws Exception {
        return curate(TOKEN, body(url, language, category, false), status);
    }

    private List<Text> libraryVideos() {
        return users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL)
                .map(u -> texts.findAll().stream().filter(t -> t.getOwner().getId().equals(u.getId())).toList())
                .orElse(List.of());
    }

    private long youtubeCalls() {
        return YOUTUBE.requests().size();
    }

    // ---- importing ----

    @Test
    void aVideoIsImportedPubliclyIntoTheCommunityLibrary() throws Exception {
        JsonNode r = curate("https://www.youtube.com/watch?v=" + FR, "fr", null, 201);
        assertThat(r.get("outcome").asString()).isEqualTo("imported");
        assertThat(r.get("videoId").asString()).isEqualTo(FR);
        assertThat(r.get("title").asString()).isEqualTo("Le marché");
        assertThat(r.get("category").asString()).isEqualTo("learners"); // YouTube's "Education", no AI here
        assertThat(r.get("id").asLong()).isPositive();

        List<Text> saved = libraryVideos();
        assertThat(saved).hasSize(1);
        tx.executeWithoutResult(s -> {
            Text t = texts.findById(saved.getFirst().getId()).orElseThrow();
            assertThat(t.isPublic()).isTrue();
            assertThat(t.getVideoId()).isEqualTo(FR);
            assertThat(t.getTimingsJson()).contains("\"start");
        });
    }

    @Test
    void theListedCategoryWins() throws Exception {
        JsonNode r = curate("https://youtu.be/" + ES, "es", "daily-life", 201);
        assertThat(r.get("category").asString()).isEqualTo("daily-life");
    }

    @Test
    void anImportedVideoAppearsInExploreForItsLanguage() throws Exception {
        curate("https://youtu.be/" + ES, "es", null, 201);
        String learner = api.signup();
        JsonNode explore = api.get(learner, "/api/library?kind=video&language=es&size=50", 200);
        assertThat(explore.get("items").findValuesAsString("title")).contains("La cocina");
    }

    @Test
    void everyYouTubeUrlFormIsAccepted() throws Exception {
        for (String url : List.of("https://www.youtube.com/shorts/" + FR, "https://www.youtube.com/embed/" + ES)) {
            assertThat(curate(url, url.contains(FR) ? "fr" : "es", null, 201).get("outcome").asString()).isEqualTo("imported");
        }
    }

    // ---- duplicates ----

    @Test
    void aVideoAlreadyInTheLibraryIsNotImportedAgainOrFetched() throws Exception {
        curate("https://youtu.be/" + FR, "fr", null, 201);
        long calls = youtubeCalls();
        JsonNode again = curate("https://www.youtube.com/watch?v=" + FR + "&t=30s", "fr", null, 200);
        assertThat(again.get("outcome").asString()).isEqualTo("already_imported");
        assertThat(again.get("title").asString()).isEqualTo("Le marché");
        assertThat(libraryVideos()).hasSize(1);
        assertThat(youtubeCalls()).isEqualTo(calls);
    }

    @Test
    void aLearnersOwnCopyDoesNotCountAsAlreadyImported() throws Exception {
        String learner = api.signupPro();
        api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + FR).param("language", "fr"),
                learner, 201);
        assertThat(curate("https://youtu.be/" + FR, "fr", null, 201).get("outcome").asString()).isEqualTo("imported");
        JsonNode mine = api.get(learner, "/api/texts", 200);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).get("isPublic").asBoolean()).isFalse();
    }

    // ---- videos that can't be imported ----

    @Test
    void aVideoWithoutCaptionsInItsLanguageIsSkippedAndNothingSaved() throws Exception {
        JsonNode r = curate("https://youtu.be/" + FR, "de", null, 422);
        assertThat(r.get("code").asString()).isEqualTo("no_captions");
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void aVideoYouTubeCannotFindFails() throws Exception {
        JsonNode r = curate("https://youtu.be/CCCCCCCCCCC", "fr", null, 422);
        assertThat(r.get("code").asString()).isEqualTo("unprocessable");
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void aBadLineIsRejected() throws Exception {
        assertThat(curate("https://example.com/v", "fr", null, 400).get("code").asString()).isEqualTo("bad_request");
        curate("https://youtu.be/" + FR, "xx", null, 400);
        curate("https://youtu.be/" + FR, "fr", "nonsense", 400);
        curate("https://youtu.be/" + FR, null, null, 400);
        assertThat(libraryVideos()).isEmpty();
    }

    // ---- limits and dry runs ----

    @Test
    void planLimitsDoNotApplyToTheLibraryAccount() throws Exception {
        String[] ids = {FR, ES, "DDDDDDDDDDD"};
        YOUTUBE.add(ids[2], YouTubeStub.Video.withCaptions("Le parc", 30, "fr", YouTubeStub.srv3("0|2000|Il fait beau.")));
        for (String id : ids) {
            curate("https://youtu.be/" + id, id.equals(ES) ? "es" : "fr", null, 201);
        }
        assertThat(libraryVideos()).hasSize(3); // more than the free limit of 2
    }

    @Test
    void aDryRunImportsNothingAndNeverContactsYouTube() throws Exception {
        curate("https://youtu.be/" + FR, "fr", null, 201);
        long calls = youtubeCalls();
        assertThat(curate(TOKEN, body("https://youtu.be/" + ES, "es", null, true), 200).get("outcome").asString())
                .isEqualTo("would_import");
        assertThat(curate(TOKEN, body("https://youtu.be/" + FR, "fr", null, true), 200).get("outcome").asString())
                .isEqualTo("already_imported");
        assertThat(libraryVideos()).hasSize(1);
        assertThat(youtubeCalls()).isEqualTo(calls);
    }

    // ---- access ----

    @Test
    void theOptionsListLanguagesAndCategories() throws Exception {
        var request = MockMvcRequestBuilders.get("/api/curator/options").header(HEADER, TOKEN);
        JsonNode options = api.send(request, null, 200);
        assertThat(options.get("languages").valueStream().map(JsonNode::asString)).contains("fr", "es", "ja");
        assertThat(options.get("categories").valueStream().map(JsonNode::asString)).contains("daily-life", "other");
    }

    @Test
    void aWrongOrMissingTokenIsRefused() throws Exception {
        assertThat(curate("wrong", body("https://youtu.be/" + FR, "fr", null, false), 401).get("code").asString())
                .isEqualTo("unauthorized");
        curate(null, body("https://youtu.be/" + FR, "fr", null, false), 401);
        api.send(MockMvcRequestBuilders.get("/api/curator/options").header(HEADER, "wrong"), null, 401);
        assertThat(libraryVideos()).isEmpty();
        assertThat(youtubeCalls()).isZero();
    }

    @Test
    void aSignedInLearnerCannotUseTheEndpoint() throws Exception {
        String learner = api.signupPro();
        api.send(MockMvcRequestBuilders.post("/api/curator/videos").contentType(MediaType.APPLICATION_JSON)
                .content(body("https://youtu.be/" + FR, "fr", null, false)), learner, 401);
        api.send(MockMvcRequestBuilders.get("/api/curator/options"), learner, 401);
        assertThat(libraryVideos()).isEmpty();
    }

    // ---- the normal import is unchanged ----

    @Test
    void theNormalLibraryImportIsStillPrivateAndLimited() throws Exception {
        String learner = api.signup(); // free plan: 2 imports here
        JsonNode first = api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + FR)
                .param("language", "fr"), learner, 201);
        assertThat(first.get("isPublic").asBoolean()).isFalse();
        assertThat(first.get("mine").asBoolean()).isTrue();
        api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + ES).param("language", "es"),
                learner, 201);
        api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + FR).param("language", "fr"),
                learner, 402);
        assertThat(libraryVideos()).isEmpty();
    }
}
