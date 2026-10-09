package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class SignOutEverywhereApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    @Test
    void everyEarlierSessionIsSignedOutAndANewSignInWorks() throws Exception {
        String email = "everywhere-" + System.nanoTime() + "@example.com";
        String first = signup(email);
        String second = login(email);

        api.post(first, "/api/me/sign-out-everywhere", "{}", 204);

        api.get(first, "/api/me", 401);
        api.get(second, "/api/me", 401);
        Thread.sleep(1100);
        api.get(login(email), "/api/me", 200);
    }

    @Test
    void itNeedsASignedInAccount() throws Exception {
        api.post(null, "/api/me/sign-out-everywhere", "{}", 401);
    }

    private String signup(String email) throws Exception {
        JsonNode r = api.post(null, "/api/auth/signup", "{\"email\":\"" + email + "\",\"password\":\"password123\"}", 201);
        return "Bearer " + r.get("token").asString();
    }

    private String login(String email) throws Exception {
        JsonNode r = api.post(null, "/api/auth/login", "{\"email\":\"" + email + "\",\"password\":\"password123\"}", 200);
        return "Bearer " + r.get("token").asString();
    }
}
