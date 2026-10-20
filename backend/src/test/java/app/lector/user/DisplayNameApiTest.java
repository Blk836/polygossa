package app.lector.user;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class DisplayNameApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    @Test
    void aNameOfOnlySpacesIsRefusedAndTheNameKept() throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"displayName\":\"Ana\"}", 200);
        String message = api.patch(token, "/api/me", "{\"displayName\":\"   \"}", 400).get("message").asString();
        assertThat(message).isEqualTo("Your name can't be blank.");
        assertThat(api.get(token, "/api/me", 200).get("displayName").asString()).isEqualTo("Ana");
    }

    @Test
    void aNameIsSavedWithoutItsOuterSpaces() throws Exception {
        String token = api.signup();
        assertThat(api.patch(token, "/api/me", "{\"displayName\":\"  Ana  \"}", 200).get("displayName").asString())
                .isEqualTo("Ana");
    }

    @Test
    void otherChangesWithoutANameStillWork() throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"displayName\":\"Ana\"}", 200);
        api.patch(token, "/api/me", "{\"timezone\":\"Europe/Madrid\"}", 200);
        assertThat(api.get(token, "/api/me", 200).get("displayName").asString()).isEqualTo("Ana");
    }
}
