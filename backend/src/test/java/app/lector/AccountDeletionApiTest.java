package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AccountDeletionApiTest {

    static final List<String> USER_COLUMNS =
            List.of("user_id", "owner_id", "author_id", "teacher_id", "student_id", "target_user_id");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    TestApi api;
    String ana;
    String ben;
    long anaId;
    String anaEmail;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        ana = api.signup();
        api.post(ana, "/api/me/plan", "{\"tier\":\"CLASSROOM\"}", 200);
        ben = api.signupPro();
        JsonNode me = api.get(ana, "/api/me", 200);
        anaId = me.get("id").asLong();
        anaEmail = me.get("email").asString();
    }

    private int deleteAccount(String token, String confirmEmail) throws Exception {
        String body = json.writeValueAsString(Map.of("confirmEmail", confirmEmail));
        return mvc.perform(delete("/api/me").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(body)).andReturn().getResponse().getStatus();
    }

    private List<String> leftovers(long userId) {
        List<String> found = new ArrayList<>();
        for (Map<String, Object> col : jdbc.queryForList("select table_name, column_name from information_schema.columns"
                + " where table_schema = current_schema() and column_name in ('" + String.join("','", USER_COLUMNS) + "')")) {
            String table = (String) col.get("table_name");
            String column = (String) col.get("column_name");
            Integer n = jdbc.queryForObject("select count(*) from " + table + " where " + column + " = ?", Integer.class, userId);
            if (n != null && n > 0) {
                found.add(table + "." + column);
            }
        }
        if (jdbc.queryForObject("select count(*) from users where id = ?", Integer.class, userId) > 0) {
            found.add("users.id");
        }
        return found;
    }

    @Test
    void deletingTheAccountLeavesNothingOfItAndOthersKeepTheirOwnData() throws Exception {
        long shared = api.createText(ana, "es", "Hola amigo.", true);
        long privateText = api.createText(ana, "es", "Buenos días.", false);
        api.send(multipart("/api/texts/" + privateText + "/audio")
                .file(new MockMultipartFile("file", "a.mp3", "audio/mpeg", new byte[] {1, 2, 3})), ana, 200);
        api.post(ana, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"hola\",\"textId\":" + shared + "}", 201);
        api.post(ana, "/api/texts/" + shared + "/progress", "{\"position\":1}", 200);
        long playlist = api.post(ana, "/api/playlists", "{\"title\":\"Mine\",\"language\":\"es\"}", 201).get("id").asLong();
        api.put(ana, "/api/playlists/" + playlist + "/items/" + shared, "", 204);
        api.patch(ana, "/api/playlists/" + playlist, "{\"isPublic\":true}", 200);
        String photo = api.send(multipart("/api/me/photo").file(new MockMultipartFile("file", "me.png", "image/png",
                ProfilePhotoApiTest.image("png", 8))), ana, 200).get("photoUrl").asString();
        Path photoFile = Path.of("build/test-uploads").resolve(photo.substring(photo.indexOf("?v=") + 3));
        JsonNode cls = api.post(ana, "/api/classes", "{\"name\":\"Clase\",\"language\":\"es\"}", 201);
        long thread = api.post(ana, "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"Ana's question\",\"body\":\"Hello\"}", 201).get("id").asLong();

        api.post(ben, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"amigo\",\"textId\":" + shared + "}", 201);
        api.put(ben, "/api/library/" + shared + "/like", "", 204);
        api.put(ben, "/api/playlists/" + playlist + "/bookmark", "", 204);
        api.post(ben, "/api/classes/join", "{\"code\":\"" + cls.get("joinCode").asString() + "\"}", 200);
        api.post(ben, "/api/forum/threads/" + thread + "/posts", "{\"body\":\"An answer\"}", 201);
        long benThread = api.post(ben, "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"Ben's question\",\"body\":\"Hi\"}", 201).get("id").asLong();
        api.post(ana, "/api/forum/threads/" + benThread + "/posts", "{\"body\":\"Ana's reply\"}", 201);
        assertThat(Files.exists(photoFile)).isTrue();
        assertThat(leftovers(anaId)).isNotEmpty();

        assertThat(deleteAccount(ana, anaEmail.toUpperCase())).isEqualTo(204);

        assertThat(leftovers(anaId)).isEmpty();
        assertThat(Files.exists(photoFile)).isFalse();
        api.get(ana, "/api/me", 401);
        api.get(ben, "/api/texts/" + shared, 404);
        api.get(ben, "/api/playlists/" + playlist, 404);
        api.get(ben, "/api/forum/threads/" + thread, 404);
        JsonNode benThreadNow = api.get(ben, "/api/forum/threads/" + benThread, 200);
        assertThat(benThreadNow.toString()).doesNotContain("Ana's reply");
        JsonNode words = api.get(ben, "/api/vocabulary?language=es", 200);
        assertThat(words.toString()).contains("amigo");
        api.get(ben, "/api/me", 200);
    }

    @Test
    void itMustBeConfirmedWithTheAccountsEmail() throws Exception {
        long text = api.createText(ana, "es", "Hola.", false);

        assertThat(deleteAccount(ana, "someone-else@example.com")).isEqualTo(400);
        assertThat(deleteAccount(ana, "")).isEqualTo(400);

        api.get(ana, "/api/me", 200);
        api.get(ana, "/api/texts/" + text, 200);
    }

    @Test
    void itNeedsASignedInAccount() throws Exception {
        assertThat(deleteAccount(null, "x@example.com")).isEqualTo(401);
    }
}
