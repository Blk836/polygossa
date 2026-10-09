package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class ProfilePhotoApiTest {

    private static final Path STORAGE = Path.of("build/test-uploads");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signup();
    }

    static byte[] image(String format, int size) throws Exception {
        var img = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        var out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    private static MockMultipartFile file(String name, String type, byte[] bytes) {
        return new MockMultipartFile("file", name, type, bytes);
    }

    private JsonNode upload(String token, MockMultipartFile file, int status) throws Exception {
        return api.send(multipart("/api/me/photo").file(file), token, status);
    }

    private JsonNode uploadPng(String token) throws Exception {
        return upload(token, file("me.png", "image/png", image("png", 8)), 200);
    }

    private MockHttpServletResponse fetch(String token, String url) throws Exception {
        var request = get(url);
        if (token != null) {
            request.header("Authorization", token);
        }
        return mvc.perform(request).andReturn().getResponse();
    }

    private static Path stored(String photoUrl) {
        return STORAGE.resolve(photoUrl.substring(photoUrl.indexOf("?v=") + 3));
    }

    private long myId() throws Exception {
        return api.get(me, "/api/me", 200).get("id").asLong();
    }

    @Test
    void aNewUserHasNoPhoto() throws Exception {
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").isNull()).isTrue();
    }

    @Test
    void uploadingAPngStoresItAndServesItBack() throws Exception {
        byte[] png = image("png", 8);
        JsonNode result = upload(me, file("me.png", "image/png", png), 200);
        String url = result.get("photoUrl").asString();
        assertThat(url).startsWith("/api/users/" + myId() + "/photo?v=");
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").asString()).isEqualTo(url);

        MockHttpServletResponse served = fetch(me, url);
        assertThat(served.getStatus()).isEqualTo(200);
        assertThat(served.getContentType()).isEqualTo("image/png");
        assertThat(served.getContentAsByteArray()).isEqualTo(png);
        assertThat(served.getHeader("Cache-Control")).contains("private").contains("max-age=31536000");
        assertThat(stored(url)).exists();
    }

    @Test
    void jpegsAreAcceptedAndServedAsJpeg() throws Exception {
        String url = upload(me, file("me.jpg", "image/jpeg", image("jpg", 8)), 200).get("photoUrl").asString();
        assertThat(fetch(me, url).getContentType()).isEqualTo("image/jpeg");
        assertThat(url).endsWith(".jpg");
    }

    @Test
    void theRealContentDecidesTheTypeNotTheNameOrDeclaredType() throws Exception {
        String url = upload(me, file("me.txt", "application/octet-stream", image("png", 8)), 200)
                .get("photoUrl").asString();
        assertThat(url).endsWith(".png");
        assertThat(fetch(me, url).getContentType()).isEqualTo("image/png");
    }

    @Test
    void changingThePhotoDeletesTheOldFile() throws Exception {
        String first = uploadPng(me).get("photoUrl").asString();
        String second = upload(me, file("b.jpg", "image/jpeg", image("jpg", 8)), 200).get("photoUrl").asString();
        assertThat(second).isNotEqualTo(first);
        assertThat(stored(first)).doesNotExist();
        assertThat(stored(second)).exists();
        assertThat(fetch(me, second).getContentType()).isEqualTo("image/jpeg");
    }

    @Test
    void removingThePhotoDeletesTheFile() throws Exception {
        String url = uploadPng(me).get("photoUrl").asString();
        JsonNode after = api.delete(me, "/api/me/photo", 200);
        assertThat(after.get("photoUrl").isNull()).isTrue();
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").isNull()).isTrue();
        assertThat(stored(url)).doesNotExist();
        assertThat(fetch(me, url).getStatus()).isEqualTo(404);
    }

    @Test
    void removingWhenThereIsNoPhotoIsHarmless() throws Exception {
        assertThat(api.delete(me, "/api/me/photo", 200).get("photoUrl").isNull()).isTrue();
    }

    @Test
    void contentThatIsNotAPngOrJpegIsRejected() throws Exception {
        String url = uploadPng(me).get("photoUrl").asString();
        for (byte[] bytes : new byte[][] {"%PDF-1.4 not an image".getBytes(), "GIF89a......".getBytes(),
                {(byte) 0xFF, (byte) 0xD8}, {(byte) 0x89, 'P', 'N', 'G'}}) {
            JsonNode error = upload(me, file("x.png", "image/png", bytes), 400);
            assertThat(error.get("message").asString()).isEqualTo("Please upload a JPEG or PNG image");
        }
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").asString()).isEqualTo(url);
        assertThat(stored(url)).exists();
    }

    @Test
    void anUploadOverOneMegabyteIsRejected() throws Exception {
        byte[] big = Arrays.copyOf(image("png", 8), 1024 * 1024 + 1);
        upload(me, file("big.png", "image/png", big), 400);
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").isNull()).isTrue();
    }

    @Test
    void anUploadOfExactlyOneMegabyteIsAccepted() throws Exception {
        byte[] max = Arrays.copyOf(image("png", 8), 1024 * 1024);
        upload(me, file("max.png", "image/png", max), 200);
    }

    @Test
    void anEmptyUploadIsRejected() throws Exception {
        upload(me, file("e.png", "image/png", new byte[0]), 400);
        assertThat(api.get(me, "/api/me", 200).get("photoUrl").isNull()).isTrue();
    }

    @Test
    void photosNeedASignedInUser() throws Exception {
        String url = uploadPng(me).get("photoUrl").asString();
        assertThat(fetch(null, url).getStatus()).isEqualTo(401);
    }

    @Test
    void anyoneSignedInCanSeeAPhoto() throws Exception {
        String url = uploadPng(me).get("photoUrl").asString();
        assertThat(fetch(api.signup(), url).getStatus()).isEqualTo(200);
    }

    @Test
    void aUserWithoutAPhotoOrAnUnknownUserIs404() throws Exception {
        mvc.perform(get("/api/users/" + myId() + "/photo").header("Authorization", me)).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/999999999/photo").header("Authorization", me)).andExpect(status().isNotFound());
    }

    @Test
    void storedFileNamesAreRandom() throws Exception {
        String url = uploadPng(me).get("photoUrl").asString();
        String name = stored(url).getFileName().toString();
        assertThat(UUID.fromString(name.substring(0, name.indexOf('.')))).isNotNull();
        assertThat(Files.size(stored(url))).isPositive();
    }
}
