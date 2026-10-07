package app.lector;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class ApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String signup() throws Exception {
        String body = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + UUID.randomUUID() + "@test.co\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asString();
    }

    private JsonNode postJson(String token, String path, String body, int expectedStatus) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) {
            request.header("Authorization", token);
        }
        String response = mvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return response.isEmpty() ? null : json.readTree(response);
    }

    @Test
    void rejectsUnauthenticatedRequests() throws Exception {
        mvc.perform(get("/api/texts")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/texts").header("Authorization", "Bearer not-a-jwt")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/languages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(9))
                .andExpect(jsonPath("$[0].code").value("en"));
    }

    @Test
    void devLoginReturnsTheSameFullyUnlockedTestAccount() throws Exception {
        JsonNode first = postJson(null, "/api/auth/dev-login", "", 200);
        JsonNode second = postJson(null, "/api/auth/dev-login", "", 200);
        org.assertj.core.api.Assertions.assertThat(first.get("user").get("id").asLong())
                .isEqualTo(second.get("user").get("id").asLong());
        org.assertj.core.api.Assertions.assertThat(first.get("user").get("plan").get("tier").asString())
                .isEqualTo("CLASSROOM");
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + first.get("token").asString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@lector.local"));
    }

    @Test
    void readingFlowTracksWordStatuses() throws Exception {
        String token = signup();
        JsonNode text = postJson(token, "/api/texts",
                "{\"title\":\"Prueba\",\"language\":\"es\",\"content\":\"El gato come. El perro duerme.\"}", 201);
        long id = text.get("id").asLong();

        postJson(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"Gato\",\"textId\":" + id
                + ",\"contextSentence\":\"El gato come.\"}", 201);
        postJson(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"el\",\"status\":\"known\"}", 201);

        mvc.perform(get("/api/texts/" + id).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statuses.gato").value("learning"))
                .andExpect(jsonPath("$.statuses.el").value("known"))
                .andExpect(jsonPath("$.text.stats.unseen").value(3))
                .andExpect(jsonPath("$.tokens[0].text").value("El"));

        JsonNode done = postJson(token, "/api/texts/" + id + "/complete", "", 200);
        org.assertj.core.api.Assertions.assertThat(done.get("markedKnown").asInt()).isEqualTo(3);

        mvc.perform(get("/api/vocabulary?language=es&status=known").header("Authorization", token))
                .andExpect(jsonPath("$.total").value(4));
        mvc.perform(get("/api/dashboard").header("Authorization", token))
                .andExpect(jsonPath("$.languages[0].known").value(4))
                .andExpect(jsonPath("$.languages[0].learning").value(1));
    }

    @Test
    void enforcesFreePlanLimitsAndProFeatures() throws Exception {
        String token = signup();
        for (int i = 0; i < 5; i++) {
            postJson(token, "/api/texts", "{\"title\":\"t\",\"language\":\"fr\",\"content\":\"Bonjour.\"}", 201);
        }
        postJson(token, "/api/texts", "{\"title\":\"t\",\"language\":\"fr\",\"content\":\"Bonjour.\"}", 402);
        mvc.perform(get("/api/review/queue").header("Authorization", token)).andExpect(status().isPaymentRequired());

        postJson(token, "/api/me/plan", "{\"tier\":\"PRO\"}", 200);
        postJson(token, "/api/texts", "{\"title\":\"t\",\"language\":\"fr\",\"content\":\"Bonjour.\"}", 201);
        mvc.perform(get("/api/review/queue").header("Authorization", token)).andExpect(status().isOk());
    }

    @Test
    void privateTextsAreHiddenFromOtherUsers() throws Exception {
        String owner = signup();
        String other = signup();
        long id = postJson(owner, "/api/texts",
                "{\"title\":\"Privado\",\"language\":\"de\",\"content\":\"Hallo Welt.\"}", 201).get("id").asLong();
        mvc.perform(get("/api/texts/" + id).header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(patch("/api/texts/" + id).header("Authorization", owner)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"isPublic\":true}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/texts/" + id).header("Authorization", other)).andExpect(status().isOk());
        mvc.perform(get("/api/library?language=de").header("Authorization", other))
                .andExpect(jsonPath("$.items[0].title").value("Privado"));
    }
}
