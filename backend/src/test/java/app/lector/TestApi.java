package app.lector;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Small helper for MockMvc API tests: sign up users and send JSON with status assertions. */
public final class TestApi {

    private final MockMvc mvc;
    private final ObjectMapper json;

    public TestApi(MockMvc mvc, ObjectMapper json) {
        this.mvc = mvc;
        this.json = json;
    }

    /** Signs up a fresh user and returns its "Bearer …" header value. */
    public String signup() throws Exception {
        JsonNode r = post(null, "/api/auth/signup",
                "{\"email\":\"" + UUID.randomUUID() + "@test.co\",\"password\":\"password123\"}", 201);
        return "Bearer " + r.get("token").asString();
    }

    public String signupPro() throws Exception {
        String token = signup();
        post(token, "/api/me/plan", "{\"tier\":\"PRO\"}", 200);
        return token;
    }

    public JsonNode post(String token, String path, String body, int expectedStatus) throws Exception {
        return send(MockMvcRequestBuilders.post(path).contentType(MediaType.APPLICATION_JSON).content(body), token, expectedStatus);
    }

    public JsonNode get(String token, String path, int expectedStatus) throws Exception {
        return send(MockMvcRequestBuilders.get(path), token, expectedStatus);
    }

    public JsonNode put(String token, String path, String body, int expectedStatus) throws Exception {
        return send(MockMvcRequestBuilders.put(path).contentType(MediaType.APPLICATION_JSON).content(body), token, expectedStatus);
    }

    public JsonNode patch(String token, String path, String body, int expectedStatus) throws Exception {
        return send(MockMvcRequestBuilders.patch(path).contentType(MediaType.APPLICATION_JSON).content(body), token, expectedStatus);
    }

    public JsonNode delete(String token, String path, int expectedStatus) throws Exception {
        return send(MockMvcRequestBuilders.delete(path), token, expectedStatus);
    }

    public JsonNode send(AbstractMockHttpServletRequestBuilder<?> request, String token, int expectedStatus) throws Exception {
        if (token != null) {
            request.header("Authorization", token);
        }
        String body = mvc.perform(request).andExpect(status().is(expectedStatus)).andReturn().getResponse()
                .getContentAsString();
        return body.isEmpty() || !body.startsWith("{") && !body.startsWith("[") ? null : json.readTree(body);
    }

    /** Creates a text and returns its id. */
    public long createText(String token, String language, String content, boolean isPublic) throws Exception {
        return post(token, "/api/texts", "{\"title\":\"T\",\"language\":\"" + language + "\",\"content\":\""
                + content + "\",\"isPublic\":" + isPublic + "}", 201).get("id").asLong();
    }
}
