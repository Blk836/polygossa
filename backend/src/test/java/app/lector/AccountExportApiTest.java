package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AccountExportApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    private MockHttpServletResponse export(String token) throws Exception {
        var request = get("/api/me/export");
        if (token != null) {
            request.header("Authorization", token);
        }
        return mvc.perform(request).andReturn().getResponse();
    }

    @Test
    void theFileHasTheAccountItsTextsWordsProgressAndWritingButNoOneElsesData() throws Exception {
        String ana = api.signupPro();
        String ben = api.signupPro();
        long text = api.createText(ana, "es", "Hola mundo, buenos días.", false);
        api.post(ana, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"mundo\",\"note\":\"world\"}", 201);
        api.post(ana, "/api/texts/" + text + "/progress", "{\"position\":1}", 200);
        api.createText(ben, "es", "Texto de Ben.", false);
        api.post(ben, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"perro\"}", 201);

        MockHttpServletResponse res = export(ana);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(res.getContentType()).startsWith("application/json");
        assertThat(res.getHeader("Content-Disposition")).startsWith("attachment;").endsWith("-data.json\"");
        JsonNode file = json.readTree(res.getContentAsString());
        String email = api.get(ana, "/api/me", 200).get("email").asString();
        assertThat(file.get("account").get("email").asString()).isEqualTo(email);
        assertThat(file.get("account").has("password_hash")).isFalse();
        assertThat(file.get("exportedAt").asString()).isNotBlank();
        assertThat(file.get("texts").toString()).contains("Hola mundo, buenos días.");
        assertThat(file.get("vocabulary_entries").toString()).contains("mundo").contains("world");
        assertThat(file.get("reading_progress")).hasSize(1);
        String all = file.toString();
        assertThat(all).doesNotContain("Texto de Ben").doesNotContain("perro");
    }

    @Test
    void itNeedsASignedInAccount() throws Exception {
        assertThat(export(null).getStatus()).isEqualTo(401);
    }
}
