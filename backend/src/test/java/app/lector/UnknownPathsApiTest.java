package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class UnknownPathsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;
    private String user;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        user = api.signup();
    }

    @Test
    void aPathThatDoesNotExistIsNotFound() throws Exception {
        JsonNode body = api.get(user, "/api/sentences", 404);
        assertThat(body.get("code").asString()).isEqualTo("not_found");
    }

    @Test
    void anUnknownPathUnderAnExistingOneIsNotFound() throws Exception {
        JsonNode body = api.get(user, "/api/me/no-such-thing", 404);
        assertThat(body.get("code").asString()).isEqualTo("not_found");
    }

    @Test
    void aMethodThePathDoesNotSupportIsNotAllowed() throws Exception {
        JsonNode body = api.put(user, "/api/me/export", "{}", 405);
        assertThat(body.get("code").asString()).isEqualTo("method_not_allowed");
    }

    @Test
    void aBodyTypeTheEndpointDoesNotTakeIsUnsupported() throws Exception {
        JsonNode body = api.send(MockMvcRequestBuilders.post("/api/texts").contentType(MediaType.TEXT_PLAIN).content("hello"),
                user, 415);
        assertThat(body.get("code").asString()).isEqualTo("unsupported_media_type");
    }

    @Test
    void signedOutAnUnknownPathStillNeedsSignIn() throws Exception {
        api.get(null, "/api/sentences", 401);
    }
}
