package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Feature: the library is scoped to one language at a time (the language picked in the top bar). */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:langscope;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false"
})
@AutoConfigureMockMvc
class LanguageScopeApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private static List<String> languages(JsonNode list) {
        List<String> out = new ArrayList<>();
        list.forEach(t -> out.add(t.get("language").asString()));
        return out;
    }

    @Test
    void myLibraryListsOnlyTheRequestedLanguage() throws Exception {
        api.createText(user, "fr", "Bonjour.", false);
        api.createText(user, "es", "Hola.", false);
        api.createText(user, "fr", "Salut.", false);

        assertThat(languages(api.get(user, "/api/texts?language=fr", 200))).containsExactly("fr", "fr");
        assertThat(languages(api.get(user, "/api/texts?language=es", 200))).containsExactly("es");
        assertThat(api.get(user, "/api/texts?language=de", 200)).isEmpty();
    }

    @Test
    void myLibraryWithoutALanguageListsEverything() throws Exception {
        api.createText(user, "fr", "Bonjour.", false);
        api.createText(user, "es", "Hola.", false);
        assertThat(languages(api.get(user, "/api/texts", 200))).containsExactlyInAnyOrder("fr", "es");
    }

    @Test
    void languageAndKindFiltersCombine() throws Exception {
        api.createText(user, "fr", "Bonjour.", false);
        assertThat(api.get(user, "/api/texts?language=fr&kind=text", 200)).hasSize(1);
        assertThat(api.get(user, "/api/texts?language=fr&kind=video", 200)).isEmpty();
    }

    @Test
    void bookmarksAreScopedToTheRequestedLanguage() throws Exception {
        String author = api.signupPro();
        long fr = api.createText(author, "fr", "Bonjour.", true);
        long es = api.createText(author, "es", "Hola.", true);
        api.send(put("/api/library/" + fr + "/bookmark"), user, 204);
        api.send(put("/api/library/" + es + "/bookmark"), user, 204);

        assertThat(languages(api.get(user, "/api/library/bookmarks?language=fr", 200))).containsExactly("fr");
        assertThat(languages(api.get(user, "/api/library/bookmarks", 200))).containsExactlyInAnyOrder("fr", "es");
    }

    @Test
    void unknownLanguageIsABadRequest() throws Exception {
        api.get(user, "/api/texts?language=xx", 400);
        api.get(user, "/api/library/bookmarks?language=xx", 400);
    }

    @Test
    void switchingTheCurrentLanguageIsRemembered() throws Exception {
        api.send(patch("/api/me")
                .contentType(MediaType.APPLICATION_JSON).content("{\"targetLanguage\":\"ja\"}"), user, 200);
        assertThat(api.get(user, "/api/me", 200).get("targetLanguage").asString()).isEqualTo("ja");
    }
}
