package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** native-language.feature: the native-language setting. */
@ApiTest
class NativeLanguageApiTest {

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
    void englishByDefault() throws Exception {
        assertThat(api.get(user, "/api/me", 200).get("nativeLanguage").asString()).isEqualTo("en");
    }

    @Test
    void choosingMyNativeLanguage() throws Exception {
        assertThat(api.patch(user, "/api/me", "{\"nativeLanguage\":\"es\"}", 200).get("nativeLanguage").asString())
                .isEqualTo("es");
        assertThat(api.get(user, "/api/me", 200).get("nativeLanguage").asString()).isEqualTo("es");
        // Other fields left out of the request are untouched, and the reverse.
        api.patch(user, "/api/me", "{\"displayName\":\"Ana\"}", 200);
        assertThat(api.get(user, "/api/me", 200).get("nativeLanguage").asString()).isEqualTo("es");
    }

    @Test
    void anUnknownNativeLanguageIsRefused() throws Exception {
        api.patch(user, "/api/me", "{\"nativeLanguage\":\"es\"}", 200);
        api.patch(user, "/api/me", "{\"nativeLanguage\":\"xx\"}", 400);
        assertThat(api.get(user, "/api/me", 200).get("nativeLanguage").asString()).isEqualTo("es");
    }

    @Test
    void listsTheNativeLanguagesOnOffer() throws Exception {
        JsonNode list = api.get(user, "/api/languages/native", 200);
        assertThat(list.get(0).get("code").asString()).isEqualTo("en");
        assertThat(list.valueStream().map(n -> n.get("code").asString())).contains("es", "ru", "zh", "ar");
        assertThat(list.get(0).get("name").asString()).isEqualTo("English");
        assertThat(list.get(0).get("nativeName").asString()).isEqualTo("English");
    }

    @Test
    void signUpStartsFromTheBrowsersLanguage() throws Exception {
        assertThat(signup("pt-BR").get("user").get("nativeLanguage").asString()).isEqualTo("pt");
        assertThat(signup("fi").get("user").get("nativeLanguage").asString()).isEqualTo("en");
        assertThat(signup(null).get("user").get("nativeLanguage").asString()).isEqualTo("en");
    }

    private JsonNode signup(String browserLanguage) throws Exception {
        String extra = browserLanguage == null ? "" : ",\"nativeLanguage\":\"" + browserLanguage + "\"";
        return api.post(null, "/api/auth/signup", "{\"email\":\"" + UUID.randomUUID() + "@test.co\","
                + "\"password\":\"password123\"" + extra + "}", 201);
    }
}
