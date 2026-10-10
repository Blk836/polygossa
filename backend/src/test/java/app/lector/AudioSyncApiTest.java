package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AudioSyncApiTest {

    private static final MockMultipartFile MP3 =
            new MockMultipartFile("file", "a.mp3", "audio/mpeg", new byte[] {1, 2, 3, 4});
    private static final MockMultipartFile SRT = new MockMultipartFile("file", "ep.srt", "text/plain",
            "1\n00:00:01,000 --> 00:00:02,000\nuno dos\n\n2\n00:00:05,000 --> 00:00:06,000\ntres\n".getBytes());

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String pro;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        pro = api.signupPro();
    }

    private JsonNode upload(String token, long textId, MockMultipartFile file, int status) throws Exception {
        return api.send(multipart("/api/texts/" + textId + "/audio").file(file), token, status);
    }

    private long subtitleText(String token) throws Exception {
        return api.send(multipart("/api/texts/import-subtitles").file(SRT).param("language", "es"), token, 201)
                .get("id").asLong();
    }

    @Test
    void freeUsersCannotAttachAudio() throws Exception {
        String free = api.signup();
        upload(free, api.createText(free, "es", "Hola.", false), MP3, 402);
    }

    @Test
    void onlyAudioFilesAreAccepted() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        upload(pro, id, new MockMultipartFile("file", "x.txt", "text/plain", new byte[] {1}), 400);
        upload(pro, id, new MockMultipartFile("file", "x.mp3", "audio/mpeg", new byte[0]), 400);
    }

    @Test
    void subtitleCuesDriveTheAlignment() throws Exception {
        long id = subtitleText(pro);
        JsonNode detail = upload(pro, id, MP3, 200);
        assertThat(detail.get("audio").get("src").asString()).isEqualTo("/api/texts/" + id + "/audio");
        assertThat(detail.get("audio").get("hasCues").asBoolean()).isTrue();
        JsonNode timings = api.post(pro, "/api/texts/" + id + "/timings/auto", "{\"durationMs\":9000}", 200)
                .get("timings");
        assertThat(timings).hasSize(3);
        assertThat(timings.get(0).get("s").asLong()).isEqualTo(1000);
        assertThat(timings.get(1).get("e").asLong()).isEqualTo(2000);
        assertThat(timings.get(2).get("s").asLong()).isEqualTo(5000);
        assertThat(api.get(pro, "/api/texts/" + id, 200).get("audio").get("timings")).hasSize(3);
    }

    @Test
    void withoutCuesTheWholeDurationIsEstimated() throws Exception {
        long id = api.createText(pro, "es", "Uno dos. Tres.", false);
        upload(pro, id, MP3, 200);
        JsonNode timings = api.post(pro, "/api/texts/" + id + "/timings/auto", "{\"durationMs\":6000}", 200)
                .get("timings");
        assertThat(timings).hasSize(3);
        assertThat(timings.get(2).get("e").asLong()).isLessThanOrEqualTo(6000);
    }

    @Test
    void sentenceMarksAlignAndRequireAtLeastOneMark() throws Exception {
        long id = api.createText(pro, "es", "Uno dos. Tres.", false);
        upload(pro, id, MP3, 200);
        api.post(pro, "/api/texts/" + id + "/timings/marks", "{\"marks\":[],\"durationMs\":5000}", 400);
        JsonNode timings = api.post(pro, "/api/texts/" + id + "/timings/marks",
                "{\"marks\":[{\"sentence\":0,\"startMs\":500},{\"sentence\":1,\"startMs\":3000}],\"durationMs\":5000}",
                200).get("timings");
        assertThat(timings.get(0).get("s").asLong()).isEqualTo(500);
        assertThat(timings.get(2).get("s").asLong()).isEqualTo(3000);
    }

    @Test
    void aligningWithoutAudioFails() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        api.post(pro, "/api/texts/" + id + "/timings/auto", "{\"durationMs\":1000}", 400);
    }

    @Test
    void linkedAudioReplacesUploadedAudioAndClearsTimings() throws Exception {
        long id = subtitleText(pro);
        upload(pro, id, MP3, 200);
        api.post(pro, "/api/texts/" + id + "/timings/auto", "{\"durationMs\":9000}", 200);
        api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"ftp://x\"}"), pro, 400);
        JsonNode detail = api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://cdn.example.com/a.mp3\"}"), pro, 200);
        assertThat(detail.get("audio").get("src").asString()).isEqualTo("https://cdn.example.com/a.mp3");
        assertThat(detail.get("audio").get("timings")).isEmpty();
        api.get(pro, "/api/texts/" + id + "/audio", 404);
    }

    @Test
    void removingAudioClearsIt() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        upload(pro, id, MP3, 200);
        api.send(delete("/api/texts/" + id + "/audio"), pro, 204);
        assertThat(api.get(pro, "/api/texts/" + id, 200).get("audio").isNull()).isTrue();
    }

    private static long storedFiles() throws java.io.IOException {
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("build/test-uploads"))) {
            return files.count();
        }
    }

    @Test
    void replacingOrLinkingAudioDeletesThePreviousFile() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        upload(pro, id, MP3, 200);
        long afterFirst = storedFiles();
        JsonNode detail = upload(pro, id, MP3, 200);
        assertThat(detail.get("audio").get("contentType").asString()).isEqualTo("audio/mpeg");
        assertThat(storedFiles()).isEqualTo(afterFirst);
        detail = api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://cdn.example.com/a.mp3\"}"), pro, 200);
        assertThat(storedFiles()).isEqualTo(afterFirst - 1);
        assertThat(detail.get("audio").get("contentType").isNull()).isTrue();
    }

    @Test
    void removingLinkedAudioClearsTheLink() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://cdn.example.com/a.mp3\"}"), pro, 200);
        api.send(delete("/api/texts/" + id + "/audio"), pro, 204);
        assertThat(api.get(pro, "/api/texts/" + id, 200).get("audio").isNull()).isTrue();
        assertThat(api.get(pro, "/api/texts/" + id, 200).get("text").get("hasAudio").asBoolean()).isFalse();
    }

    @Test
    void linkingAndAligningRequirePro() throws Exception {
        String free = api.signup();
        long id = api.createText(free, "es", "Hola.", false);
        api.send(put("/api/texts/" + id + "/audio-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://cdn.example.com/a.mp3\"}"), free, 402);

        long mine = api.createText(pro, "es", "Hola.", false);
        upload(pro, mine, MP3, 200);
        api.post(pro, "/api/me/plan", "{\"tier\":\"FREE\"}", 200);
        api.post(pro, "/api/texts/" + mine + "/timings/auto", "{\"durationMs\":1000}", 402);
        api.post(pro, "/api/texts/" + mine + "/timings/marks",
                "{\"marks\":[{\"sentence\":0,\"startMs\":0}],\"durationMs\":1000}", 402);
    }

    @Test
    void sentenceMarkTimingsArePersisted() throws Exception {
        long id = api.createText(pro, "es", "Uno dos. Tres.", false);
        upload(pro, id, MP3, 200);
        api.post(pro, "/api/texts/" + id + "/timings/marks",
                "{\"marks\":[{\"sentence\":0,\"startMs\":0}],\"durationMs\":3000}", 200);
        assertThat(api.get(pro, "/api/texts/" + id, 200).get("audio").get("timings")).hasSize(3);
    }

    @Test
    void onlyTheOwnerCanChangeAudioAndOnlyReadersCanStreamIt() throws Exception {
        long id = api.createText(pro, "es", "Hola.", true);
        upload(pro, id, MP3, 200);
        String other = api.signupPro();
        upload(other, id, MP3, 403);
        api.get(other, "/api/texts/" + id + "/audio", 200);
        long hidden = api.createText(pro, "es", "Secreto.", false);
        upload(pro, hidden, MP3, 200);
        api.get(other, "/api/texts/" + hidden + "/audio", 404);
    }
}
