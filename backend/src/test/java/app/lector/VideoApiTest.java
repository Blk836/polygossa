package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import app.lector.text.TextRepository;
import app.lector.video.YouTubeStub;
import java.util.ArrayList;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Scenarios for importing YouTube videos and browsing texts and videos together. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:video;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false"
})
@AutoConfigureMockMvc
class VideoApiTest {

    private static final String ID = "dQw4w9WgXcQ";
    private static final String URL = "https://www.youtube.com/watch?v=" + ID;
    private static final String CAPTIONS = YouTubeStub.srv3(
            "1000|2000|Hola amigos.", "4000|3000|Hoy hablamos de la comida.");
    private static final YouTubeStub STUB = startStub();

    private static YouTubeStub startStub() {
        try {
            return new YouTubeStub();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void youtube(DynamicPropertyRegistry registry) {
        registry.add("app.youtube.base-url", STUB::baseUrl);
    }

    @AfterAll
    static void stop() {
        STUB.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        STUB.reset();
        STUB.add(ID, YouTubeStub.Video.withCaptions("Comida en Madrid", 120, "es", CAPTIONS));
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private MockMultipartHttpServletRequestBuilder importReq(String url, String language) {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/texts/import-youtube")
                .param("url", url).param("language", language);
    }

    private JsonNode importVideo(String token, MockMultipartHttpServletRequestBuilder req, int status) throws Exception {
        return api.send(req, token, status);
    }

    private long importOk(String token, boolean isPublic) throws Exception {
        return importVideo(token, importReq(URL, "es").param("isPublic", String.valueOf(isPublic)), 201)
                .get("id").asLong();
    }

    private int countMine(String token) throws Exception {
        return api.get(token, "/api/texts", 200).size();
    }

    private List<String> titles(JsonNode items) {
        List<String> out = new ArrayList<>();
        items.forEach(n -> out.add(n.get("title").asString()));
        return out;
    }

    // ---- Feature: Import a YouTube video ----

    @Test
    void importsAVideoWithCaptionsInTheChosenLanguage() throws Exception {
        JsonNode summary = importVideo(user, importReq(URL, "es"), 201);
        assertThat(summary.get("kind").asString()).isEqualTo("video");
        assertThat(summary.get("title").asString()).isEqualTo("Comida en Madrid");
        assertThat(summary.get("video").get("videoId").asString()).isEqualTo(ID);
        assertThat(summary.get("video").get("thumbnailUrl").asString())
                .isEqualTo("https://i.ytimg.com/vi/" + ID + "/hqdefault.jpg");
        assertThat(summary.get("video").get("durationSeconds").asInt()).isEqualTo(120);
        assertThat(summary.get("sourceUrl").asString()).isEqualTo(URL);
        assertThat(summary.get("cefrLevel").asString()).isNotBlank();
        assertThat(summary.get("wordCount").asInt()).isEqualTo(7);
        assertThat(summary.get("stats").get("uniqueWords").asInt()).isEqualTo(7);
        assertThat(summary.get("hasAudio").asBoolean()).isFalse();

        JsonNode detail = api.get(user, "/api/texts/" + summary.get("id").asLong(), 200);
        assertThat(detail.get("tokens").toString()).contains("\"comida\"");
        assertThat(detail.get("audio").isNull()).isTrue();
        JsonNode video = detail.get("video");
        assertThat(video.get("videoId").asString()).isEqualTo(ID);
        assertThat(video.get("hasCues").asBoolean()).isTrue();
        JsonNode timings = video.get("timings");
        assertThat(timings.size()).isEqualTo(7);
        // The first cue's words fall within 1.0–3.0 s, the second's within 4.0–7.0 s.
        assertThat(timings.get(0).get("s").asLong()).isEqualTo(1000);
        assertThat(timings.get(1).get("e").asLong()).isLessThanOrEqualTo(3000);
        assertThat(timings.get(2).get("s").asLong()).isEqualTo(4000);
        assertThat(timings.get(6).get("e").asLong()).isEqualTo(7000);
    }

    @Test
    void typedTitleWinsOverYouTubeTitle() throws Exception {
        JsonNode summary = importVideo(user, importReq(URL, "es").param("title", "  Mi título  "), 201);
        assertThat(summary.get("title").asString()).isEqualTo("Mi título");
    }

    @Test
    void acceptsShortLinks() throws Exception {
        JsonNode summary = importVideo(user, importReq("https://youtu.be/" + ID + "?t=3", "es"), 201);
        assertThat(summary.get("video").get("videoId").asString()).isEqualTo(ID);
        assertThat(summary.get("sourceUrl").asString()).isEqualTo(URL);
    }

    @Test
    void rejectsNonYouTubeLinksWithoutCreatingAnything() throws Exception {
        for (String bad : List.of("https://vimeo.com/12345", "https://youtube.com.evil.com/watch?v=" + ID, "not a url")) {
            JsonNode err = importVideo(user, importReq(bad, "es"), 400);
            assertThat(err.get("message").asString()).isEqualTo("Not a YouTube video link");
        }
        assertThat(countMine(user)).isZero();
        assertThat(STUB.requests()).isEmpty();
    }

    @Test
    void requiresUrlAndLanguage() throws Exception {
        api.send(multipart("/api/texts/import-youtube").param("language", "es"), user, 400);
        api.send(multipart("/api/texts/import-youtube").param("url", URL), user, 400);
        api.send(importReq(URL, "xx"), user, 400);
    }

    @Test
    void noCaptionsInTheChosenLanguageAndNoTranscript() throws Exception {
        JsonNode err = importVideo(user, importReq(URL, "fr"), 422);
        assertThat(err.get("message").asString())
                .isEqualTo("No French captions found — upload a subtitle file or paste the transcript");
        assertThat(countMine(user)).isZero();
    }

    @Test
    void captionFetchFailureCountsAsNoCaptions() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Comida", 200, 120, Map.of("es", "<html>blocked</html>")));
        importVideo(user, importReq(URL, "es"), 422);
        assertThat(countMine(user)).isZero();
    }

    @Test
    void ownSubtitleFileIsUsedAndNoCaptionsAreFetched() throws Exception {
        MockMultipartFile srt = new MockMultipartFile("file", "x.srt", "text/plain",
                "1\n00:00:02,000 --> 00:00:04,000\nBuenos días\n".getBytes());
        long id = importVideo(user, importReq(URL, "es").file(srt), 201).get("id").asLong();
        JsonNode detail = api.get(user, "/api/texts/" + id, 200);
        assertThat(detail.get("text").get("wordCount").asInt()).isEqualTo(2);
        assertThat(detail.get("video").get("hasCues").asBoolean()).isTrue();
        assertThat(detail.get("video").get("timings").get(0).get("s").asLong()).isEqualTo(2000);
        assertThat(STUB.requests()).noneMatch(r -> r.startsWith("/api/timedtext"));
    }

    @Test
    void subtitleFileGivesTheLengthWhenYouTubeDoesNot() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Comida", 200, null, Map.of()));
        MockMultipartFile srt = new MockMultipartFile("file", "x.srt", "text/plain",
                "1\n00:00:02,000 --> 00:01:04,200\nBuenos días\n".getBytes());
        JsonNode summary = importVideo(user, importReq(URL, "es").file(srt), 201);
        assertThat(summary.get("video").get("durationSeconds").asInt()).isEqualTo(65);
    }

    @Test
    void badSubtitleFileIsRejected() throws Exception {
        MockMultipartFile junk = new MockMultipartFile("file", "x.srt", "text/plain", "no cues".getBytes());
        importVideo(user, importReq(URL, "es").file(junk), 400);
        assertThat(countMine(user)).isZero();
    }

    @Test
    void pastedTranscriptGetsProportionalTimings() throws Exception {
        long id = importVideo(user, importReq(URL, "es").param("transcript", "Uno dos tres. Cuatro cinco."), 201)
                .get("id").asLong();
        JsonNode video = api.get(user, "/api/texts/" + id, 200).get("video");
        assertThat(video.get("hasCues").asBoolean()).isFalse();
        JsonNode timings = video.get("timings");
        assertThat(timings.size()).isEqualTo(5);
        assertThat(timings.get(0).get("s").asLong()).isZero();
        assertThat(timings.get(4).get("e").asLong()).isBetween(100_000L, 120_000L);
        assertThat(STUB.requests()).noneMatch(r -> r.startsWith("/api/timedtext"));
    }

    @Test
    void pastedTranscriptWithUnknownDurationHasNoTimings() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Comida", 200, null, Map.of()));
        long id = importVideo(user, importReq(URL, "es").param("transcript", "Uno dos tres."), 201).get("id").asLong();
        JsonNode video = api.get(user, "/api/texts/" + id, 200).get("video");
        assertThat(video.get("timings").size()).isZero();
        assertThat(video.has("durationSeconds")).isFalse();
    }

    @Test
    void youtubeUnreachableStillImportsWithMyTitleAndTranscript() throws Exception {
        STUB.setDown(true);
        JsonNode s = importVideo(user, importReq(URL, "es").param("title", "Mío").param("transcript", "Hola."), 201);
        assertThat(s.get("title").asString()).isEqualTo("Mío");
    }

    @Test
    void youtubeUnreachableWithoutTitleUsesFallbackTitle() throws Exception {
        STUB.setDown(true);
        JsonNode s = importVideo(user, importReq(URL, "es").param("transcript", "Hola."), 201);
        assertThat(s.get("title").asString()).isEqualTo("YouTube video " + ID);
    }

    @Test
    void privateOrNonEmbeddableVideosAreRejected() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("x", 401, 120, Map.of("es", CAPTIONS)));
        JsonNode err = importVideo(user, importReq(URL, "es").param("transcript", "Hola."), 422);
        assertThat(err.get("message").asString()).isEqualTo("This video is private, removed, or can't be embedded");
        assertThat(countMine(user)).isZero();
    }

    @Test
    void freePlanLimitCountsTextsAndVideosTogether() throws Exception {
        String free = api.signup();
        for (int i = 0; i < 4; i++) {
            api.createText(free, "es", "Hola " + i + ".", false);
        }
        importOk(free, false);
        assertThat(countMine(free)).isEqualTo(5);
        JsonNode err = importVideo(free, importReq(URL, "es"), 402);
        assertThat(err.get("message").asString()).contains("texts and videos");
        api.post(free, "/api/texts", "{\"title\":\"T\",\"language\":\"es\",\"content\":\"Hola.\"}", 402);
        assertThat(countMine(free)).isEqualTo(5);
    }

    @Test
    void japaneseVideoIsTokenizedWithoutTheSidecar() throws Exception {
        STUB.add(ID, YouTubeStub.Video.withCaptions("日本", 30, "ja", YouTubeStub.srv3("0|3000|今日は天気がいいです。")));
        JsonNode s = importVideo(user, importReq(URL, "ja"), 201);
        assertThat(s.get("wordCount").asInt()).isPositive();
    }

    @Test
    void videosCannotHaveSeparateAudio() throws Exception {
        long id = importOk(user, false);
        api.send(multipart("/api/texts/" + id + "/audio")
                .file(new MockMultipartFile("file", "a.mp3", "audio/mpeg", new byte[] {1, 2})), user, 400);
        api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://example.com/a.mp3\"}"), user, 400);
        assertThat(api.get(user, "/api/texts/" + id, 200).get("video").get("timings").size()).isEqualTo(7);
    }

    // ---- Feature: Word highlighting follows the transcript with overlapping captions ----

    /** Timings in start-time order must visit words in transcript order, or the highlight jumps back a line. */
    private static void assertTranscriptOrderByStart(JsonNode timings) {
        List<long[]> list = new ArrayList<>();
        timings.forEach(t -> list.add(new long[] {t.get("s").asLong(), t.get("i").asLong()}));
        list.sort((a, b) -> a[0] != b[0] ? Long.compare(a[0], b[0]) : Long.compare(a[1], b[1]));
        for (int k = 1; k < list.size(); k++) {
            assertThat(list.get(k)[1]).isGreaterThan(list.get(k - 1)[1]);
        }
    }

    @Test
    void overlappingCaptionsGiveTimingsInTranscriptOrder() throws Exception {
        STUB.add(ID, YouTubeStub.Video.withCaptions("Rolling", 60, "es",
                YouTubeStub.srv3("1000|4000|uno dos tres cuatro", "3000|4000|cinco seis siete")));
        long id = importOk(user, false);
        JsonNode timings = api.get(user, "/api/texts/" + id, 200).get("video").get("timings");
        assertThat(timings.size()).isEqualTo(7);
        assertThat(timings.get(3).get("e").asLong()).isEqualTo(3000);
        assertTranscriptOrderByStart(timings);
    }

    @Test
    void videoTimingsStoredBeforeTheFixAreRebuiltFromCuesOnLoad() throws Exception {
        STUB.add(ID, YouTubeStub.Video.withCaptions("Rolling", 60, "es",
                YouTubeStub.srv3("1000|4000|uno dos tres cuatro", "3000|4000|cinco seis siete")));
        long id = importOk(user, false);
        // What the old aligner stored: line 1's tail words start after line 2's first words.
        storeTimings(id, "[{\"i\":0,\"s\":1000,\"e\":2000},{\"i\":2,\"s\":2000,\"e\":3000},"
                + "{\"i\":4,\"s\":3000,\"e\":4000},{\"i\":6,\"s\":4000,\"e\":5000},"
                + "{\"i\":8,\"s\":3000,\"e\":4500},{\"i\":10,\"s\":4500,\"e\":6000},{\"i\":12,\"s\":6000,\"e\":7000}]");
        JsonNode timings = api.get(user, "/api/texts/" + id, 200).get("video").get("timings");
        assertThat(timings.size()).isEqualTo(7);
        assertTranscriptOrderByStart(timings);
        assertThat(timings.get(6).get("e").asLong()).isEqualTo(7000);
    }

    @Test
    void videoWithoutCuesKeepsItsStoredTimings() throws Exception {
        long id = importVideo(user, importReq(URL, "es").param("transcript", "Uno dos tres."), 201).get("id").asLong();
        String stored = "[{\"i\":0,\"s\":5,\"e\":6},{\"i\":2,\"s\":1,\"e\":2},{\"i\":4,\"s\":7,\"e\":8}]";
        storeTimings(id, stored);
        JsonNode timings = api.get(user, "/api/texts/" + id, 200).get("video").get("timings");
        assertThat(timings).isEqualTo(json.readTree(stored));
    }

    private void storeTimings(long id, String timingsJson) {
        var text = texts.findById(id).orElseThrow();
        text.setTimingsJson(timingsJson);
        texts.save(text);
    }

    // ---- Feature: Library and Explore cover texts and videos ----

    @Test
    void myLibraryListsBothKindsNewestFirstAndFiltersByKind() throws Exception {
        api.post(user, "/api/texts", "{\"title\":\"Texto A\",\"language\":\"es\",\"content\":\"Hola.\"}", 201);
        importOk(user, false);
        api.post(user, "/api/texts", "{\"title\":\"Texto B\",\"language\":\"es\",\"content\":\"Adiós.\"}", 201);

        JsonNode all = api.get(user, "/api/texts", 200);
        assertThat(titles(all)).containsExactly("Texto B", "Comida en Madrid", "Texto A");
        assertThat(all.get(0).get("kind").asString()).isEqualTo("text");
        assertThat(all.get(0).has("video")).isFalse();
        assertThat(all.get(1).get("kind").asString()).isEqualTo("video");

        assertThat(titles(api.get(user, "/api/texts?kind=video", 200))).containsExactly("Comida en Madrid");
        assertThat(titles(api.get(user, "/api/texts?kind=text", 200))).containsExactly("Texto B", "Texto A");
        assertThat(titles(api.get(user, "/api/texts?kind=VIDEO", 200))).containsExactly("Comida en Madrid");
    }

    @Test
    void invalidKindFilterIsRejected() throws Exception {
        api.get(user, "/api/texts?kind=podcast", 400);
        api.get(user, "/api/library?kind=podcast", 400);
        api.get(user, "/api/library/bookmarks?kind=podcast", 400);
    }

    @Test
    void sharedVideosAppearInExploreAndCanBeFilteredLikedAndBookmarked() throws Exception {
        String owner = api.signupPro();
        long video = importOk(owner, false);
        api.post(owner, "/api/texts", "{\"title\":\"Texto público\",\"language\":\"es\",\"content\":\"Hola amigos.\","
                + "\"isPublic\":true}", 201);
        String viewer = api.signup();
        String q = "&q=" + java.util.UUID.randomUUID(); // never matches: isolates from other tests' public items
        assertThat(api.get(viewer, "/api/library?language=es&kind=video&size=50", 200).toString()).doesNotContain(
                "\"id\":" + video + ",");

        api.send(patch("/api/texts/" + video).contentType(MediaType.APPLICATION_JSON).content("{\"isPublic\":true}"),
                owner, 200);

        JsonNode videos = api.get(viewer, "/api/library?language=es&kind=video&q=madrid&size=50", 200);
        assertThat(videos.get("items").toString()).contains("\"id\":" + video + ",");
        videos.get("items").forEach(n -> assertThat(n.get("kind").asString()).isEqualTo("video"));
        JsonNode texts = api.get(viewer, "/api/library?language=es&kind=text&q=texto&size=50", 200);
        assertThat(texts.get("total").asLong()).isPositive();
        texts.get("items").forEach(n -> assertThat(n.get("kind").asString()).isEqualTo("text"));
        assertThat(api.get(viewer, "/api/library?kind=video" + q, 200).get("total").asLong()).isZero();
        JsonNode popular = api.get(viewer, "/api/library?language=es&kind=video&sort=popular&q=madrid&size=50", 200);
        popular.get("items").forEach(n -> assertThat(n.get("kind").asString()).isEqualTo("video"));

        api.send(put("/api/library/" + video + "/like"), viewer, 204);
        api.send(put("/api/library/" + video + "/bookmark"), viewer, 204);
        JsonNode item = findItem(api.get(viewer, "/api/library?language=es&kind=video&q=madrid&size=50", 200), video);
        assertThat(item.get("likes").asLong()).isEqualTo(1);
        assertThat(item.get("liked").asBoolean()).isTrue();
        assertThat(item.get("stats").get("knownPercent").asDouble()).isZero();
        assertThat(api.get(viewer, "/api/texts/" + video, 200).get("video").get("videoId").asString()).isEqualTo(ID);

        assertThat(titles(api.get(viewer, "/api/library/bookmarks", 200))).containsExactly("Comida en Madrid");
        assertThat(api.get(viewer, "/api/library/bookmarks?kind=text", 200).size()).isZero();
        assertThat(api.get(viewer, "/api/library/bookmarks?kind=video", 200).size()).isEqualTo(1);

        // Owner unshares: it leaves Explore and the viewer's bookmarks.
        api.send(patch("/api/texts/" + video).contentType(MediaType.APPLICATION_JSON).content("{\"isPublic\":false}"),
                owner, 200);
        assertThat(api.get(viewer, "/api/library/bookmarks", 200).size()).isZero();
        assertThat(api.get(viewer, "/api/library?language=es&kind=video&q=madrid&size=50", 200).toString())
                .doesNotContain("\"id\":" + video + ",");
    }

    private static JsonNode findItem(JsonNode page, long id) {
        for (JsonNode n : page.get("items")) {
            if (n.get("id").asLong() == id) {
                return n;
            }
        }
        throw new AssertionError("item " + id + " not in page");
    }

    @Test
    void othersPrivateVideosStayPrivate() throws Exception {
        long video = importOk(user, false);
        String other = api.signup();
        api.get(other, "/api/texts/" + video, 404);
        api.send(put("/api/library/" + video + "/like"), other, 404);
        api.send(put("/api/library/" + video + "/bookmark"), other, 404);
    }

    @Test
    void teacherCanAssignAVideoToTheirClass() throws Exception {
        String teacher = api.signup();
        api.post(teacher, "/api/me/plan", "{\"tier\":\"CLASSROOM\"}", 200);
        long video = importOk(teacher, false);
        JsonNode cls = api.post(teacher, "/api/classes", "{\"name\":\"Clase\",\"language\":\"es\"}", 201);
        String student = api.signup();
        api.get(student, "/api/texts/" + video, 404);
        api.post(student, "/api/classes/join", "{\"code\":\"" + cls.get("joinCode").asString() + "\"}", 200);
        api.post(teacher, "/api/classes/" + cls.get("id").asLong() + "/assignments", "{\"textId\":" + video + "}", 201);
        assertThat(api.get(student, "/api/texts/" + video, 200).get("video").get("videoId").asString()).isEqualTo(ID);
    }

    @Test
    void plainTextsAreKindTextWithNoVideo() throws Exception {
        long id = api.createText(user, "es", "Hola.", false);
        JsonNode detail = api.get(user, "/api/texts/" + id, 200);
        assertThat(detail.get("text").get("kind").asString()).isEqualTo("text");
        assertThat(detail.get("text").has("video")).isFalse();
        assertThat(detail.get("video").isNull()).isTrue();
    }
}
