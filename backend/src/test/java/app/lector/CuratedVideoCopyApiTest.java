package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.seed.SampleContentSeeder;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.user.UserRepository;
import app.lector.video.YouTubeStub;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Feature: copying curated videos from one backend to another (docs/acceptance/copy-videos.feature), the backend side:
 * the source's export and the target's copy endpoint. Here one app plays both parts. No AI here; see
 * {@link CuratedVideoReviewApiTest} for the sharing check. Each test uses its own videos, since other classes on this
 * shared app import videos too and the export looks at every owner's copies.
 */
@YouTubeApiTest
class CuratedVideoCopyApiTest {

    private static final String TOKEN = CuratedVideoImportApiTest.TOKEN;
    private static final String HEADER = CuratedVideoImportApiTest.HEADER;
    private static final YouTubeStub YOUTUBE = YouTubeApiTest.STUB;

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
        api = new TestApi(mvc, json);
        tx.executeWithoutResult(s -> libraryVideos().forEach(texts::delete));
    }

    // ---- helpers ----

    /** A French video on the stub, with word-level captions, and returns its id. */
    private static String video(String id) {
        YOUTUBE.add(id, YouTubeStub.Video.withCaptions("Le marché", 60, "fr",
                YouTubeStub.srv3("0|2000|Bonjour à tous.", "2000|4000|On va au marché.")));
        return id;
    }

    /** A learner (Pro) imports the video; returns the text's id. */
    private long learnerImport(String id, String title, boolean isPublic) throws Exception {
        var request = multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + id)
                .param("language", "fr").param("category", "learners").param("isPublic", String.valueOf(isPublic));
        if (title != null) {
            request.param("title", title);
        }
        return api.send(request, api.signupPro(), 201).get("id").asLong();
    }

    private JsonNode export(String token, String id, String language, int status) throws Exception {
        var request = MockMvcRequestBuilders.get("/api/curator/videos/" + id + "/copy").param("language", language);
        if (token != null) {
            request.header(HEADER, token);
        }
        return api.send(request, null, status);
    }

    private JsonNode copy(String token, String body, int status) throws Exception {
        var request = MockMvcRequestBuilders.post("/api/curator/copies").contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) {
            request.header(HEADER, token);
        }
        return api.send(request, null, status);
    }

    private JsonNode copy(JsonNode exported, boolean dryRun, int status) throws Exception {
        ObjectNode body = (ObjectNode) exported.deepCopy();
        body.put("dryRun", dryRun);
        return copy(TOKEN, json.writeValueAsString(body), status);
    }

    private List<Text> libraryVideos() {
        return users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL)
                .map(u -> texts.findAll().stream().filter(t -> t.getOwner().getId().equals(u.getId())).toList())
                .orElse(List.of());
    }

    // ---- copying ----

    @Test
    void theExportHoldsTheFinishedTranscript() throws Exception {
        String id = video("CPYEXPORT01");
        learnerImport(id, null, false);
        JsonNode exported = export(TOKEN, id, "fr", 200);
        assertThat(exported.get("videoId").asString()).isEqualTo(id);
        assertThat(exported.get("language").asString()).isEqualTo("fr");
        assertThat(exported.get("title").asString()).isEqualTo("Le marché");
        assertThat(exported.get("category").asString()).isEqualTo("learners");
        assertThat(exported.get("durationSeconds").asInt()).isEqualTo(60);
        assertThat(exported.get("content").asString()).isEqualTo("Bonjour à tous.\nOn va au marché.");
        assertThat(exported.get("cues")).hasSize(2);
        assertThat(exported.get("cues").get(1).get("startMs").asLong()).isEqualTo(2000);
    }

    @Test
    void aCopyIsSavedPubliclyInTheLibraryWithoutAskingYouTube() throws Exception {
        String id = video("CPYCOPY0001");
        long source = learnerImport(id, null, false);
        JsonNode exported = export(TOKEN, id, "fr", 200);
        int calls = YOUTUBE.requests().size();

        JsonNode r = copy(exported, false, 201);
        assertThat(r.get("outcome").asString()).isEqualTo("imported");
        assertThat(r.get("title").asString()).isEqualTo("Le marché");
        assertThat(r.get("category").asString()).isEqualTo("learners");
        assertThat(YOUTUBE.requests()).hasSize(calls);

        List<Text> saved = libraryVideos();
        assertThat(saved).hasSize(1);
        tx.executeWithoutResult(s -> {
            Text original = texts.findById(source).orElseThrow();
            Text copied = texts.findById(saved.getFirst().getId()).orElseThrow();
            assertThat(copied.isPublic()).isTrue();
            assertThat(copied.getVideoId()).isEqualTo(id);
            assertThat(copied.getVideoDurationSeconds()).isEqualTo(60);
            assertThat(copied.getSourceUrl()).isEqualTo("https://www.youtube.com/watch?v=" + id);
            assertThat(copied.getContent()).isEqualTo(original.getContent());
            assertThat(copied.getCuesJson()).isEqualTo(original.getCuesJson());
            // Worked out again on this backend, and they match a normal import of the same transcript.
            assertThat(copied.getTokensJson()).isEqualTo(original.getTokensJson());
            assertThat(copied.getTimingsJson()).isEqualTo(original.getTimingsJson());
            assertThat(copied.getCefrLevel()).isEqualTo(original.getCefrLevel());
            assertThat(copied.getWordCount()).isEqualTo(original.getWordCount());
        });

        JsonNode explore = api.get(api.signup(), "/api/library?kind=video&language=fr&size=200", 200);
        assertThat(explore.get("items").valueStream().map(item -> item.get("id").asLong()))
                .contains(saved.getFirst().getId());
    }

    @Test
    void thePublicCopyIsSentAndTheNewestOfSeveral() throws Exception {
        String id = video("CPYPICK0001");
        learnerImport(id, "Privé", false);
        learnerImport(id, "Ancien", true);
        learnerImport(id, "Récent", true);
        learnerImport(id, "Privé récent", false);
        assertThat(export(TOKEN, id, "fr", 200).get("title").asString()).isEqualTo("Récent");
    }

    @Test
    void aVideoTheSourceLacksInThatLanguageIsNotFound() throws Exception {
        String id = video("CPYMISSING1");
        learnerImport(id, null, false);
        assertThat(export(TOKEN, "CPYNOTHERE1", "fr", 404).get("code").asString()).isEqualTo("not_on_source");
        assertThat(export(TOKEN, id, "es", 404).get("code").asString()).isEqualTo("not_on_source");
    }

    // ---- re-runs and dry runs ----

    @Test
    void copyingAgainChangesNothing() throws Exception {
        String id = video("CPYAGAIN001");
        learnerImport(id, null, false);
        JsonNode exported = export(TOKEN, id, "fr", 200);
        long first = copy(exported, false, 201).get("id").asLong();
        JsonNode again = copy(exported, false, 200);
        assertThat(again.get("outcome").asString()).isEqualTo("already_imported");
        assertThat(again.get("id").asLong()).isEqualTo(first);
        assertThat(libraryVideos()).hasSize(1);
    }

    @Test
    void aDryRunSavesNothing() throws Exception {
        String id = video("CPYDRYRUN01");
        learnerImport(id, null, false);
        JsonNode exported = export(TOKEN, id, "fr", 200);
        assertThat(copy(exported, true, 200).get("outcome").asString()).isEqualTo("would_import");
        assertThat(libraryVideos()).isEmpty();
        copy(exported, false, 201);
        assertThat(copy(exported, true, 200).get("outcome").asString()).isEqualTo("already_imported");
        assertThat(libraryVideos()).hasSize(1);
    }

    // ---- refused ----

    @Test
    void aCopyWithMissingOrInvalidPartsIsRefused() throws Exception {
        String good = "\"videoId\":\"CPYBAD00001\",\"language\":\"fr\",\"title\":\"T\",\"category\":\"food\"";
        copy(TOKEN, "{" + good + ",\"cues\":[]}", 400); // no transcript
        copy(TOKEN, "{" + good + ",\"content\":\"   \"}", 400);
        copy(TOKEN, "{" + good.replace("\"fr\"", "\"xx\"") + ",\"content\":\"Bonjour.\"}", 400);
        copy(TOKEN, "{" + good.replace("food", "nonsense") + ",\"content\":\"Bonjour.\"}", 400);
        copy(TOKEN, "{" + good.replace("CPYBAD00001", "bad id") + ",\"content\":\"Bonjour.\"}", 400);
        copy(TOKEN, "{" + good.replace(",\"language\":\"fr\"", "") + ",\"content\":\"Bonjour.\"}", 400);
        copy(TOKEN, "{" + good + ",\"content\":\"Bonjour.\",\"cues\":[{\"startMs\":0,\"endMs\":1000,\"text\":\"x\","
                + "\"charStart\":0,\"charEnd\":99}]}", 400); // a cue beyond the transcript
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void aWrongTokenOrALearnerIsRefused() throws Exception {
        String body = "{\"videoId\":\"CPYTOKEN001\",\"language\":\"fr\",\"title\":\"T\",\"content\":\"Bonjour.\"}";
        assertThat(copy("wrong", body, 401).get("code").asString()).isEqualTo("unauthorized");
        copy(null, body, 401);
        export("wrong", "CPYTOKEN001", "fr", 401);
        export(null, "CPYTOKEN001", "fr", 401);
        String learner = api.signupPro();
        api.send(MockMvcRequestBuilders.post("/api/curator/copies").contentType(MediaType.APPLICATION_JSON).content(body),
                learner, 401);
        api.send(MockMvcRequestBuilders.get("/api/curator/videos/CPYTOKEN001/copy").param("language", "fr"), learner, 401);
        assertThat(libraryVideos()).isEmpty();
    }
}
