package app.lector.book;

import static app.lector.book.BookFiles.chapter;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.ApiTest;
import app.lector.TestApi;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class BookImportApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    private JsonNode upload(String token, byte[] bytes, String name, int status) throws Exception {
        return api.send(multipart("/api/texts/import-book")
                .file(new MockMultipartFile("file", name, "application/octet-stream", bytes))
                .param("language", "es"), token, status);
    }

    private static byte[] book(int chapters) {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("cover.xhtml", "<html><body><img src=\"c.jpg\"/></body></html>");
        for (int i = 1; i <= chapters; i++) {
            files.put("c" + i + ".xhtml", chapter("Capítulo " + i, "El texto del capítulo " + i + "."));
        }
        return BookFiles.epub("El viaje", files);
    }

    @Test
    void anEpubBecomesAPrivatePlaylistOfChapters() throws Exception {
        String token = api.signupPro();
        JsonNode r = upload(token, book(2), "viaje.epub", 201);
        assertThat(r.get("title").asString()).isEqualTo("El viaje");
        List<Long> ids = r.get("textIds").valueStream().map(JsonNode::asLong).toList();
        assertThat(ids).hasSize(2);

        JsonNode playlist = api.get(token, "/api/playlists/" + r.get("playlistId").asLong(), 200);
        assertThat(playlist.get("playlist").get("title").asString()).isEqualTo("El viaje");
        assertThat(playlist.get("playlist").get("isPublic").asBoolean()).isFalse();
        assertThat(playlist.get("items").valueStream().map(i -> i.get("title").asString()))
                .containsExactly("Capítulo 1", "Capítulo 2");

        JsonNode first = api.get(token, "/api/texts/" + ids.getFirst(), 200).get("text");
        assertThat(first.get("title").asString()).isEqualTo("Capítulo 1");
        assertThat(first.get("isPublic").asBoolean()).isFalse();
        assertThat(first.get("language").asString()).isEqualTo("es");
    }

    @Test
    void aChapterCantBeSharedButCanStillBeEdited() throws Exception {
        String token = api.signupPro();
        long id = upload(token, book(2), "viaje.epub", 201).get("textIds").get(0).asLong();
        JsonNode refused = api.patch(token, "/api/texts/" + id, "{\"isPublic\":true}", 400);
        assertThat(refused.get("message").asString()).contains("imported from a book").contains("can't be shared");
        JsonNode text = api.get(token, "/api/texts/" + id, 200).get("text");
        assertThat(text.get("isPublic").asBoolean()).isFalse();
        assertThat(text.get("fromBook").asBoolean()).isTrue();

        JsonNode renamed = api.patch(token, "/api/texts/" + id, "{\"title\":\"Primero\",\"category\":\"stories\"}", 200);
        assertThat(renamed.get("title").asString()).isEqualTo("Primero");
        assertThat(renamed.get("category").asString()).isEqualTo("stories");
        assertThat(renamed.get("fromBook").asBoolean()).isTrue();
    }

    @Test
    void aPastedTextIsNotFromABookAndCanBeShared() throws Exception {
        String token = api.signupPro();
        long id = api.createText(token, "es", "Un texto pegado.", false);
        assertThat(api.get(token, "/api/texts/" + id, 200).get("text").get("fromBook").asBoolean()).isFalse();
        assertThat(api.patch(token, "/api/texts/" + id, "{\"isPublic\":true}", 200).get("isPublic").asBoolean()).isTrue();
    }

    @Test
    void aSharedBookPlaylistCountsItsChaptersApartFromOtherPrivateItems() throws Exception {
        String token = api.signupPro();
        JsonNode r = upload(token, book(2), "viaje.epub", 201);
        long playlist = r.get("playlistId").asLong();
        api.patch(token, "/api/playlists/" + playlist, "{\"isPublic\":true}", 200);
        JsonNode detail = api.get(token, "/api/playlists/" + playlist, 200);
        assertThat(detail.get("privateItems").asInt()).isZero();
        assertThat(detail.get("privateBookItems").asInt()).isEqualTo(2);

        long pasted = api.createText(token, "es", "Un texto pegado.", false);
        api.put(token, "/api/playlists/" + playlist + "/items/" + pasted, "{}", 204);
        detail = api.get(token, "/api/playlists/" + playlist, 200);
        assertThat(detail.get("privateItems").asInt()).isEqualTo(1);
        assertThat(detail.get("privateBookItems").asInt()).isEqualTo(2);
    }

    @Test
    void aPdfImportsToo() throws Exception {
        String token = api.signupPro();
        byte[] pdf = BookFiles.pdf("Apuntes", List.of(List.of("Una pagina de apuntes en espanol.")), Map.of());
        JsonNode r = upload(token, pdf, "apuntes.pdf", 201);
        assertThat(r.get("title").asString()).isEqualTo("Apuntes");
        assertThat(r.get("textIds")).hasSize(1);
    }

    @Test
    void filesThatCantBeImported() throws Exception {
        String token = api.signupPro();
        assertThat(upload(token, "hola".getBytes(), "notes.txt", 400).get("message").asString())
                .contains("Upload an EPUB or a PDF");
        assertThat(api.get(token, "/api/texts", 200)).isEmpty();
        assertThat(api.get(token, "/api/playlists", 200)).isEmpty();
    }

    @Test
    void theFreePlansTextLimitCoversTheWholeBook() throws Exception {
        String token = api.signup();
        for (int i = 0; i < 3; i++) {
            api.createText(token, "es", "Texto " + i + ".", false);
        }
        JsonNode error = upload(token, book(4), "viaje.epub", 402);
        assertThat(error.get("message").asString()).contains("4 texts").contains("2 left");
        assertThat(api.get(token, "/api/texts", 200)).hasSize(3);
        assertThat(api.get(token, "/api/playlists", 200)).isEmpty();
        upload(token, book(2), "viaje.epub", 201);
    }
}
