package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.seed.SampleContentSeeder;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.user.UserRepository;
import app.lector.video.YouTubeStub;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@YouTubeApiTest
class LongVideoApiTest {

    private static final String ID = "LongVideo01";
    private static final String URL = "https://www.youtube.com/watch?v=" + ID;
    private static final String LINE = "Bonjour à tous, aujourd'hui on parle du marché de la ville.";
    private static final int CUE_MS = 3000;
    private static final String TOO_LONG =
            "This video's transcript is too long to import (the limit is about five hours of speech)";
    private static final YouTubeStub STUB = YouTubeApiTest.STUB;

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
    String user;

    @BeforeEach
    void setUp() throws Exception {
        STUB.reset();
        api = new TestApi(mvc, json);
        user = api.signupPro();
        tx.executeWithoutResult(s -> libraryVideos().forEach(texts::delete));
    }

    private static int linesFor(int chars) {
        return chars / (LINE.length() + 1) + 1;
    }

    private static void captions(int chars) {
        int lines = linesFor(chars);
        String[] timed = new String[lines];
        for (int i = 0; i < lines; i++) {
            timed[i] = (i * CUE_MS) + "|" + CUE_MS + "|" + LINE;
        }
        STUB.add(ID, YouTubeStub.Video.withCaptions("Une longue interview", lines * 3, "fr", YouTubeStub.srv3(timed)));
    }

    private static String srt(int chars) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < linesFor(chars); i++) {
            sb.append(i + 1).append('\n').append(time(i * CUE_MS)).append(" --> ").append(time(i * CUE_MS + CUE_MS))
                    .append('\n').append(LINE).append("\n\n");
        }
        return sb.toString();
    }

    private static String time(long ms) {
        return String.format("%02d:%02d:%02d,%03d", ms / 3_600_000, ms / 60_000 % 60, ms / 1000 % 60, ms % 1000);
    }

    private static String pasted(int chars) {
        return (LINE + " ").repeat(chars / (LINE.length() + 1) + 1).strip();
    }

    private MockMultipartHttpServletRequestBuilder importReq() {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/texts/import-youtube")
                .param("url", URL).param("language", "fr");
    }

    private JsonNode curator(String path, String body, int status) throws Exception {
        var request = MockMvcRequestBuilders.post(path).contentType(MediaType.APPLICATION_JSON).content(body)
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN);
        return api.send(request, null, status);
    }

    private List<Text> libraryVideos() {
        return users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL)
                .map(u -> texts.findAll().stream().filter(t -> t.getOwner().getId().equals(u.getId())).toList())
                .orElse(List.of());
    }

    private int countMine(String token) throws Exception {
        return api.get(token, "/api/texts", 200).size();
    }

    private String content(long id) {
        return tx.execute(s -> texts.findById(id).orElseThrow().getContent());
    }

    @Test
    void captionsLongerThanATextImportWholeAsOneLessonTimedToTheEnd() throws Exception {
        captions(150_000);
        long id = api.send(importReq(), user, 201).get("id").asLong();

        assertThat(content(id)).hasSizeGreaterThan(150_000).startsWith(LINE).endsWith(LINE);
        JsonNode timings = api.get(user, "/api/texts/" + id, 200).get("video").get("timings");
        long lastCueEnd = (long) linesFor(150_000) * CUE_MS;
        assertThat(timings.get(timings.size() - 1).get("e").asLong()).isEqualTo(lastCueEnd);
        assertThat(countMine(user)).isEqualTo(1);
    }

    @Test
    void aLongSubtitleFileImportsAsOneLesson() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Une longue interview", 200, null, java.util.Map.of()));
        MockMultipartFile file = new MockMultipartFile("file", "x.srt", "text/plain", srt(150_000).getBytes());
        long id = api.send(importReq().file(file), user, 201).get("id").asLong();
        assertThat(content(id)).hasSizeGreaterThan(150_000);
    }

    @Test
    void aLongPastedTranscriptImportsAsOneLesson() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Une longue interview", 200, 9000, java.util.Map.of()));
        long id = api.send(importReq().param("transcript", pasted(150_000)), user, 201).get("id").asLong();
        assertThat(content(id)).hasSizeGreaterThan(150_000);
    }

    @Test
    void theCuratorImportsALongVideoIntoTheLibrary() throws Exception {
        captions(150_000);
        JsonNode r = curator("/api/curator/videos", CuratedVideoImportApiTest.body(URL, "fr", null, false), 201);
        assertThat(r.get("outcome").asString()).isEqualTo("imported");
        assertThat(libraryVideos()).hasSize(1);
    }

    @Test
    void theCuratorCopiesALongVideoIntoTheLibrary() throws Exception {
        captions(150_000);
        api.send(importReq(), user, 201);
        var export = MockMvcRequestBuilders.get("/api/curator/videos/" + ID + "/copy").param("language", "fr")
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN);
        ObjectNode body = (ObjectNode) api.send(export, null, 200).deepCopy();
        body.put("dryRun", false);

        JsonNode r = curator("/api/curator/copies", json.writeValueAsString(body), 201);
        assertThat(r.get("outcome").asString()).isEqualTo("imported");
        assertThat(libraryVideos()).hasSize(1);
    }

    @Test
    void aVideoBeyondTheVideoLimitIsRefusedWithAMessageForVideos() throws Exception {
        captions(300_001);
        JsonNode err = api.send(importReq(), user, 400);
        assertThat(err.get("message").asString()).isEqualTo(TOO_LONG).doesNotContain("split");
        assertThat(countMine(user)).isZero();
    }

    @Test
    void aSubtitleFileOrTranscriptBeyondTheVideoLimitIsRefusedTheSameWay() throws Exception {
        STUB.add(ID, new YouTubeStub.Video("Une longue interview", 200, 9000, java.util.Map.of()));
        MockMultipartFile file = new MockMultipartFile("file", "x.srt", "text/plain", srt(300_001).getBytes());
        List<String> messages = new ArrayList<>();
        messages.add(api.send(importReq().file(file), user, 400).get("message").asString());
        messages.add(api.send(importReq().param("transcript", pasted(300_001)), user, 400).get("message").asString());
        assertThat(messages).containsOnly(TOO_LONG);
        assertThat(countMine(user)).isZero();
    }

    @Test
    void aVideoBeyondTheLimitIsRefusedForTheLibraryToo() throws Exception {
        captions(300_001);
        JsonNode err = curator("/api/curator/videos", CuratedVideoImportApiTest.body(URL, "fr", null, false), 400);
        assertThat(err.get("message").asString()).isEqualTo(TOO_LONG);
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void textsThatAreNotVideosKeepTheirLimit() throws Exception {
        ObjectNode body = json.createObjectNode().put("title", "Long").put("language", "fr")
                .put("content", "a".repeat(100_001));
        JsonNode err = api.post(user, "/api/texts", json.writeValueAsString(body), 400);
        assertThat(err.get("message").asString())
                .isEqualTo("Texts are limited to 100000 characters; split it into parts");
        assertThat(countMine(user)).isZero();
    }
}
