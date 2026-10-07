package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** feature-tours.feature: which first-visit tours an account still gets, kept on the account. */
@ApiTest
class ToursApiTest {

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

    private static List<String> seen(JsonNode me) {
        List<String> names = new ArrayList<>();
        me.get("tours").get("seen").forEach(n -> names.add(n.asString()));
        return names;
    }

    private static boolean on(JsonNode me) {
        return me.get("tours").get("on").asBoolean();
    }

    @Test
    void aNewAccountGetsToursWithNoneSeen() throws Exception {
        JsonNode me = api.get(user, "/api/me", 200);
        assertThat(on(me)).isTrue();
        assertThat(seen(me)).isEmpty();
    }

    @Test
    void theDevelopmentAccountGetsNoTours() throws Exception {
        JsonNode login = api.post(null, "/api/auth/dev-login", "", 200);
        assertThat(on(login.get("user"))).isFalse();
    }

    @Test
    void aSeenTourIsRememberedOnTheAccountOnceEach() throws Exception {
        JsonNode me = api.post(user, "/api/me/tours/library/seen", "", 200);
        assertThat(seen(me)).containsExactly("library");
        api.post(user, "/api/me/tours/reader/seen", "", 200);
        api.post(user, "/api/me/tours/library/seen", "", 200);
        JsonNode later = api.get(user, "/api/me", 200);
        assertThat(seen(later)).containsExactly("library", "reader");
        assertThat(on(later)).isTrue();
    }

    @Test
    void skippingAllTurnsToursOffAndShowingAgainResetsThem() throws Exception {
        api.post(user, "/api/me/tours/library/seen", "", 200);
        JsonNode off = api.patch(user, "/api/me", "{\"tours\":false}", 200);
        assertThat(on(off)).isFalse();
        assertThat(on(api.get(user, "/api/me", 200))).isFalse();

        JsonNode again = api.patch(user, "/api/me", "{\"tours\":true}", 200);
        assertThat(on(again)).isTrue();
        assertThat(seen(again)).isEmpty();
    }

    @Test
    void otherProfileChangesLeaveToursAlone() throws Exception {
        api.post(user, "/api/me/tours/words-x/seen", "", 200);
        JsonNode me = api.patch(user, "/api/me", "{\"displayName\":\"Ana\"}", 200);
        assertThat(on(me)).isTrue();
        assertThat(seen(me)).containsExactly("words-x");
    }

    @Test
    void badTourNamesAreRefusedAndNothingIsStored() throws Exception {
        api.post(user, "/api/me/tours/Library/seen", "", 400);
        api.post(user, "/api/me/tours/lib,rary/seen", "", 400);
        api.post(user, "/api/me/tours/-library/seen", "", 400);
        api.post(user, "/api/me/tours/" + "a".repeat(31) + "/seen", "", 400);
        api.post(user, "/api/me/tours/" + "a".repeat(30) + "/seen", "", 200);
        assertThat(seen(api.get(user, "/api/me", 200))).containsExactly("a".repeat(30));
    }

    @Test
    void thereIsALimitOnHowManyToursAreKept() throws Exception {
        for (int i = 0; i < 40; i++) {
            api.post(user, "/api/me/tours/t-" + (char) ('a' + i / 26) + (char) ('a' + i % 26) + "/seen", "", 200);
        }
        api.post(user, "/api/me/tours/one-too-many/seen", "", 400);
        api.post(user, "/api/me/tours/t-aa/seen", "", 200);
        assertThat(seen(api.get(user, "/api/me", 200))).hasSize(40);
    }

    @Test
    void signedOutRequestsAreRefused() throws Exception {
        api.post(null, "/api/me/tours/library/seen", "", 401);
    }
}
