package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.storage.S3Stub;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=s3",
        "app.seed-samples=false",
        "app.storage.s3-bucket=uploads",
        "app.storage.s3-region=eu-west-1"
})
@AutoConfigureMockMvc
class S3UploadsApiTest {

    private static final S3Stub S3;
    private static final byte[] AUDIO = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    private static final MockMultipartFile MP3 = new MockMultipartFile("file", "a.mp3", "audio/mpeg", AUDIO);

    static {
        try {
            S3 = new S3Stub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        System.setProperty("aws.accessKeyId", "test");
        System.setProperty("aws.secretAccessKey", "test");
    }

    @DynamicPropertySource
    static void s3(DynamicPropertyRegistry registry) {
        registry.add("app.storage.s3-endpoint", S3::endpoint);
    }

    @AfterAll
    static void stop() {
        S3.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String pro;

    @BeforeEach
    void setUp() throws Exception {
        S3.reset();
        api = new TestApi(mvc, json);
        pro = api.signupPro();
    }

    private JsonNode uploadAudio(String token, long textId, MockMultipartFile file, int status) throws Exception {
        return api.send(multipart("/api/texts/" + textId + "/audio").file(file), token, status);
    }

    private MockHttpServletResponse fetch(String token, String path, String range) throws Exception {
        var request = get(path).header("Authorization", token);
        if (range != null) {
            request.header("Range", range);
        }
        return mvc.perform(request).andReturn().getResponse();
    }

    private Map<String, byte[]> objects() {
        return S3.objects();
    }

    @Test
    void uploadedAudioIsKeptInTheBucketAndPlaysWhole() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, MP3, 200);

        assertThat(objects()).hasSize(1);
        String key = objects().keySet().iterator().next();
        assertThat(key).matches("uploads/[a-f0-9\\-]{36}\\.mp3");
        assertThat(objects().get(key)).isEqualTo(AUDIO);
        assertThat(S3.contentType(key)).isEqualTo("audio/mpeg");

        MockHttpServletResponse whole = fetch(pro, "/api/texts/" + id + "/audio", null);
        assertThat(whole.getStatus()).isEqualTo(200);
        assertThat(whole.getContentType()).isEqualTo("audio/mpeg");
        assertThat(whole.getHeader("Accept-Ranges")).isEqualTo("bytes");
        assertThat(whole.getHeader("Content-Length")).isEqualTo("10");
        assertThat(whole.getContentAsByteArray()).isEqualTo(AUDIO);
    }

    @Test
    void aRangeRequestGetsJustThatPart() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, MP3, 200);

        MockHttpServletResponse part = fetch(pro, "/api/texts/" + id + "/audio", "bytes=2-5");

        assertThat(part.getStatus()).isEqualTo(206);
        assertThat(part.getHeader("Content-Range")).isEqualTo("bytes 2-5/10");
        assertThat(part.getHeader("Content-Length")).isEqualTo("4");
        assertThat(part.getContentType()).isEqualTo("audio/mpeg");
        assertThat(part.getContentAsByteArray()).containsExactly(3, 4, 5, 6);
    }

    @Test
    void someoneWhoCantReadTheTextGetsNotFoundAndS3IsNeverAsked() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, MP3, 200);
        String other = api.signup();

        assertThat(fetch(other, "/api/texts/" + id + "/audio", null).getStatus()).isEqualTo(404);
        assertThat(S3.requests()).noneMatch(r -> r.startsWith("GET"));
    }

    @Test
    void replacingRemovingAndDeletingTheTextDeleteTheOldFile() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, MP3, 200);
        String first = objects().keySet().iterator().next();
        uploadAudio(pro, id, MP3, 200);
        assertThat(objects()).hasSize(1).doesNotContainKey(first);

        api.delete(pro, "/api/texts/" + id + "/audio", 204);
        assertThat(objects()).isEmpty();

        uploadAudio(pro, id, MP3, 200);
        api.delete(pro, "/api/texts/" + id, 204);
        assertThat(objects()).isEmpty();
    }

    @Test
    void aFileThatIsGoneAnswersNotFound() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, MP3, 200);
        objects().clear();

        MockHttpServletResponse gone = fetch(pro, "/api/texts/" + id + "/audio", null);

        assertThat(gone.getStatus()).isEqualTo(404);
        assertThat(json.readTree(gone.getContentAsString()).get("message").asString()).isEqualTo("Audio not found");
    }

    @Test
    void s3FailingFailsTheUploadClearlyAndSavesNothing() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        S3.fail(true);

        JsonNode error = uploadAudio(pro, id, MP3, 503);

        assertThat(error.get("message").asString()).isEqualTo("Couldn't save the file. Please try again.");
        S3.fail(false);
        JsonNode text = api.get(pro, "/api/texts/" + id, 200);
        assertThat(text.get("audio").isNull()).isTrue();
        assertThat(text.get("text").get("title").asString()).isNotEmpty();
    }

    @Test
    void uploadChecksAreUnchangedAndRefusedFilesNeverReachS3() throws Exception {
        long id = api.createText(pro, "es", "Hola.", false);
        uploadAudio(pro, id, new MockMultipartFile("file", "x.txt", "text/plain", new byte[] {1}), 400);
        uploadAudio(pro, id, new MockMultipartFile("file", "x.mp3", "audio/mpeg", new byte[0]), 400);
        api.send(multipart("/api/me/photo").file(new MockMultipartFile("file", "x.png", "image/png",
                "GIF89a......".getBytes())), pro, 400);

        assertThat(S3.requests()).isEmpty();
    }

    @Test
    void aProfilePhotoIsKeptInTheBucketServedAsBeforeAndReplacedCleanly() throws Exception {
        byte[] png = ProfilePhotoApiTest.image("png", 8);
        MockMultipartFile photo = new MockMultipartFile("file", "me.png", "image/png", png);
        long me = api.get(pro, "/api/me", 200).get("id").asLong();

        api.send(multipart("/api/me/photo").file(photo), pro, 200);
        String first = objects().keySet().iterator().next();
        assertThat(first).matches("uploads/[a-f0-9\\-]{36}\\.png");

        MockHttpServletResponse served = fetch(pro, "/api/users/" + me + "/photo", null);
        assertThat(served.getStatus()).isEqualTo(200);
        assertThat(served.getContentType()).isEqualTo("image/png");
        assertThat(served.getHeader("Cache-Control")).isEqualTo("max-age=31536000, private");
        assertThat(served.getContentAsByteArray()).isEqualTo(png);

        api.send(multipart("/api/me/photo").file(photo), pro, 200);
        assertThat(objects()).hasSize(1).doesNotContainKey(first);
        api.delete(pro, "/api/me/photo", 200);
        assertThat(objects()).isEmpty();
    }
}
