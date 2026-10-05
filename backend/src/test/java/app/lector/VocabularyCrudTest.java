package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Editing, deleting and searching vocabulary entries. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:vocabcrud;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.billing.free-word-limit=1"
})
@AutoConfigureMockMvc
class VocabularyCrudTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String token;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
    }

    private long save(String body) throws Exception {
        return api.post(token, "/api/vocabulary", body, 201).get("id").asLong();
    }

    private JsonNode patchEntry(String who, long id, String body, int status) throws Exception {
        return api.send(patch("/api/vocabulary/" + id).contentType(MediaType.APPLICATION_JSON).content(body), who, status);
    }

    private JsonNode search(String query) throws Exception {
        return api.get(token, "/api/vocabulary?" + query, 200);
    }

    @Test
    void patchUpdatesStatusAndDetailsAndRespectsTheWordLimit() throws Exception {
        long id = save("{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}");
        JsonNode e = patchEntry(token, id, "{\"status\":\"ignored\",\"definition\":\"cat\"}", 200);
        assertThat(e.get("status").asString()).isEqualTo("ignored");
        assertThat(e.get("definition").asString()).isEqualTo("cat");
        save("{\"language\":\"es\",\"term\":\"perro\"}");
        patchEntry(token, id, "{\"status\":\"learning\"}", 402);
        assertThat(api.get(token, "/api/vocabulary/" + id, 200).get("status").asString()).isEqualTo("ignored");
    }

    @Test
    void otherUsersEntriesAreInvisible() throws Exception {
        long id = save("{\"language\":\"es\",\"term\":\"gato\"}");
        String other = api.signup();
        patchEntry(other, id, "{\"status\":\"known\"}", 404);
        api.get(other, "/api/vocabulary/" + id, 404);
        api.send(delete("/api/vocabulary/" + id), other, 404);
        api.get(token, "/api/vocabulary/" + id, 200);
    }

    @Test
    void deleteByIdAndByTerm() throws Exception {
        long id = save("{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\"}");
        save("{\"language\":\"es\",\"term\":\"perro\",\"status\":\"known\"}");
        api.send(delete("/api/vocabulary/" + id), token, 204);
        api.get(token, "/api/vocabulary/" + id, 404);
        api.send(delete("/api/vocabulary/by-term?language=es&term=PERRO"), token, 204);
        assertThat(search("language=es").get("total").asLong()).isZero();
        api.send(delete("/api/vocabulary/by-term?language=es&term=nada"), token, 204);
    }

    @Test
    void searchFiltersByLanguageStatusKindAndText() throws Exception {
        save("{\"language\":\"es\",\"term\":\"gato\",\"status\":\"known\",\"definition\":\"Cat\"}");
        save("{\"language\":\"es\",\"term\":\"de nada\",\"status\":\"known\"}");
        save("{\"language\":\"fr\",\"term\":\"chat\",\"status\":\"ignored\",\"definition\":\"cat\"}");
        assertThat(search("").get("total").asLong()).isEqualTo(3);
        assertThat(search("language=fr").get("total").asLong()).isEqualTo(1);
        assertThat(search("status=ignored").get("items").get(0).get("term").asString()).isEqualTo("chat");
        assertThat(search("kind=phrase").get("items").get(0).get("term").asString()).isEqualTo("de nada");
        assertThat(search("q=CAT").get("total").asLong()).as("matches definitions, case-insensitively").isEqualTo(2);
        assertThat(search("q=gat").get("total").asLong()).isEqualTo(1);
        assertThat(api.send(get("/api/vocabulary").param("q", "  "), token, 200).get("total").asLong()).as("blank query means no filter").isEqualTo(3);
    }

    @Test
    void searchSortsAndPages() throws Exception {
        save("{\"language\":\"es\",\"term\":\"b\",\"status\":\"known\"}");
        save("{\"language\":\"es\",\"term\":\"a\",\"status\":\"known\"}");
        save("{\"language\":\"es\",\"term\":\"c\",\"status\":\"known\"}");
        assertThat(search("sort=alpha").get("items")).extracting(n -> n.get("term").asString())
                .containsExactly("a", "b", "c");
        assertThat(search("sort=recent").get("items").get(0).get("term").asString()).isEqualTo("c");
        JsonNode page = search("sort=alpha&size=2&page=1");
        assertThat(page.get("items")).extracting(n -> n.get("term").asString()).containsExactly("c");
        assertThat(page.get("total").asLong()).isEqualTo(3);
        assertThat(search("size=0").get("size").asInt()).as("size is clamped to at least 1").isEqualTo(1);
        assertThat(search("size=999").get("size").asInt()).as("and at most 200").isEqualTo(200);
        assertThat(search("page=-3").get("page").asInt()).isZero();
    }
}
