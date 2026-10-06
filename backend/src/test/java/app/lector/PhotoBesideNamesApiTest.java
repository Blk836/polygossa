package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: Profile photo, "Photos next to people's names": every place the API names a person carries their photo
 * URL, or null when they have none.
 */
@ApiTest
class PhotoBesideNamesApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    /** Ana has a photo, Ben has none. */
    String ana;
    String ben;
    String anaPhoto;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        ana = api.signup();
        ben = api.signup();
        anaPhoto = api.send(multipart("/api/me/photo").file(new MockMultipartFile("file", "a.png", "image/png",
                ProfilePhotoApiTest.image("png", 4))), ana, 200).get("photoUrl").asString();
    }

    private static void hasPhoto(JsonNode person, String url) {
        assertThat(person.get("photoUrl").asString()).isEqualTo(url);
    }

    private static void hasNoPhoto(JsonNode person) {
        assertThat(person.has("photoUrl")).isTrue();
        assertThat(person.get("photoUrl").isNull()).isTrue();
    }

    @Test
    void forumThreadsAndPostsCarryTheAuthorsPhoto() throws Exception {
        String title = "Photo " + UUID.randomUUID();
        long thread = api.post(ana, "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"" + title + "\",\"body\":\"Hi\"}", 201).get("id").asLong();
        api.post(ben, "/api/forum/threads/" + thread + "/posts", "{\"body\":\"Hello\"}", 201);

        JsonNode page = api.get(ben, "/api/forum/threads/" + thread, 200);
        hasPhoto(page.get("thread").get("author"), anaPhoto);
        hasPhoto(page.get("posts").get(0).get("author"), anaPhoto);
        hasNoPhoto(page.get("posts").get(1).get("author"));

        JsonNode listed = api.send(get("/api/forum/threads").param("category", "general"), ben, 200).get("threads");
        boolean found = false;
        for (JsonNode t : listed) {
            if (t.get("id").asLong() == thread) {
                hasPhoto(t.get("author"), anaPhoto);
                found = true;
            }
        }
        assertThat(found).isTrue();
    }

    @Test
    void aSharedTextCarriesItsOwnersPhotoInTheReaderAndExplore() throws Exception {
        String title = "Photo " + UUID.randomUUID();
        long id = api.post(ana, "/api/texts", "{\"title\":\"" + title + "\",\"language\":\"es\",\"content\":\"Hola.\","
                + "\"isPublic\":true}", 201).get("id").asLong();
        hasPhoto(api.get(ben, "/api/texts/" + id, 200).get("text").get("owner"), anaPhoto);

        JsonNode items = api.send(get("/api/library").param("language", "es").param("q", title), ben, 200).get("items");
        assertThat(items).hasSize(1);
        hasPhoto(items.get(0).get("owner"), anaPhoto);

        long bens = api.createText(ben, "es", "Hola.", false);
        hasNoPhoto(api.get(ben, "/api/texts/" + bens, 200).get("text").get("owner"));
    }

    @Test
    void aSharedPlaylistCarriesItsOwnersPhoto() throws Exception {
        long p = PlaylistApiTest.create(api, ana, "Photo list", "fr");
        api.put(ana, "/api/playlists/" + p + "/items/" + api.createText(ana, "fr", "Un.", true), "", 204);
        api.patch(ana, "/api/playlists/" + p, "{\"isPublic\":true}", 200);
        hasPhoto(api.get(ben, "/api/playlists/" + p, 200).get("playlist").get("owner"), anaPhoto);
    }

    @Test
    void aClassRosterAndProgressCarryStudentsPhotos() throws Exception {
        String teacher = api.signup();
        api.post(teacher, "/api/me/plan", "{\"tier\":\"CLASSROOM\"}", 200);
        JsonNode cls = api.post(teacher, "/api/classes", "{\"name\":\"Clase\",\"language\":\"es\"}", 201);
        String join = "{\"code\":\"" + cls.get("joinCode").asString() + "\"}";
        api.post(ana, "/api/classes/join", join, 200);
        api.post(ben, "/api/classes/join", join, 200);
        long id = cls.get("id").asLong();
        long anaId = api.get(ana, "/api/me", 200).get("id").asLong();

        for (JsonNode s : api.get(teacher, "/api/classes/" + id, 200).get("students")) {
            if (s.get("id").asLong() == anaId) {
                hasPhoto(s, anaPhoto);
            } else {
                hasNoPhoto(s);
            }
        }
        JsonNode rows = api.get(teacher, "/api/classes/" + id + "/progress", 200).get("students");
        assertThat(rows).hasSize(2);
        for (JsonNode s : rows) {
            if (s.get("id").asLong() == anaId) {
                hasPhoto(s, anaPhoto);
            } else {
                hasNoPhoto(s);
            }
        }
    }
}
