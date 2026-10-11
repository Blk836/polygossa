package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ClockApiTest
class RateLimitsApiTest {

    private static final int LOOKUPS_PER_MINUTE = 120;
    private static final int IMPORTS_PER_HOUR = 60;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    private static String lookup(int i) {
        return "/api/dictionary?language=es&term=palabra" + i;
    }

    private void lookUp(String user, int count) throws Exception {
        for (int i = 0; i < count; i++) {
            api.get(user, lookup(i), 200);
        }
    }

    private void importTexts(String user, int count) throws Exception {
        for (int i = 0; i < count; i++) {
            api.createText(user, "es", "Hola amigo número " + i + ".", false);
        }
    }

    private MockHttpServletResponse call(AbstractMockHttpServletRequestBuilder<?> request, String user) throws Exception {
        return mvc.perform(request.header("Authorization", user)).andReturn().getResponse();
    }

    private void assertLimited(MockHttpServletResponse response) throws Exception {
        assertThat(response.getStatus()).isEqualTo(429);
        JsonNode body = json.readTree(response.getContentAsString());
        assertThat(body.get("code").asString()).isEqualTo("rate_limited");
        assertThat(body.get("message").asString()).isNotBlank();
    }

    @Test
    void lookupsAtTheLimitAllAnswer() throws Exception {
        String user = api.signup();
        lookUp(user, LOOKUPS_PER_MINUTE);
    }

    @Test
    void oneLookupTooManyIsLimitedAndSaysWhenToRetry() throws Exception {
        String user = api.signup();
        lookUp(user, LOOKUPS_PER_MINUTE);
        MockHttpServletResponse response = call(get(lookup(999)), user);
        assertLimited(response);
        int retryAfter = Integer.parseInt(response.getHeader("Retry-After"));
        assertThat(retryAfter).isBetween(1, 60);
    }

    @Test
    void theLookupLimitResetsTheNextMinute() throws Exception {
        String user = api.signup();
        lookUp(user, LOOKUPS_PER_MINUTE);
        api.get(user, lookup(999), 429);
        TestClock.CLOCK.advance(Duration.ofMinutes(1));
        api.get(user, lookup(999), 200);
    }

    @Test
    void oneLearnersLimitDoesNotAffectAnother() throws Exception {
        String user = api.signup();
        lookUp(user, LOOKUPS_PER_MINUTE);
        api.get(user, lookup(999), 429);
        api.get(api.signup(), lookup(999), 200);
    }

    @Test
    void tooManyImportsInAnHourAreLimitedUntilTheHourIsUp() throws Exception {
        String user = api.signupPro();
        importTexts(user, IMPORTS_PER_HOUR);
        assertLimited(call(post("/api/texts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"T\",\"language\":\"es\",\"content\":\"Hola.\",\"isPublic\":false}"), user));
        TestClock.CLOCK.advance(Duration.ofHours(1));
        api.createText(user, "es", "Hola otra vez.", false);
    }

    @Test
    void everyImportRouteCountsTowardTheSameLimit() throws Exception {
        String user = api.signupPro();
        importTexts(user, IMPORTS_PER_HOUR);
        MockMultipartFile file = new MockMultipartFile("file", "x.srt", "text/plain", "1".getBytes());
        assertLimited(call(post("/api/texts/import-url").contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://example.com\",\"language\":\"es\"}"), user));
        assertLimited(call(multipart("/api/texts/import-subtitles").file(file), user));
        assertLimited(call(multipart("/api/texts/import-youtube").file(file), user));
        assertLimited(call(multipart("/api/texts/import-book").file(file), user));
        assertLimited(call(post("/api/word-imports/lingq").contentType(MediaType.APPLICATION_JSON).content("{}"), user));
        assertLimited(call(multipart("/api/word-imports/readlang").file(file), user));
    }

    @Test
    void readingIsNotAnImport() throws Exception {
        String user = api.signupPro();
        long id = api.createText(user, "es", "Hola amigo.", false);
        importTexts(user, IMPORTS_PER_HOUR - 1);
        api.get(user, "/api/texts/" + id, 200);
        api.post(user, "/api/texts/" + id + "/complete", "{}", 200);
        api.post(user, "/api/texts/" + id + "/mark-known", "{\"fromToken\":0,\"toToken\":1}", 200);
    }
}
