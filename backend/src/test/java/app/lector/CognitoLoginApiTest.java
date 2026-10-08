package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.config.JwtService;
import app.lector.user.AuthUser;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: login with Cognito (docs/acceptance/cognito-login.feature), set up as production is: Cognito configured
 * (a fake pool, {@link CognitoStub}) and the app's own accounts and auto-login off.
 */
@SpringBootTest(properties = {
        "test.database=cognito",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.dev-auto-login=false",
        "app.login.local-accounts=false",
        "app.login.cognito-client-id=" + CognitoStub.CLIENT_ID
})
@AutoConfigureMockMvc
class CognitoLoginApiTest {

    private static final CognitoStub POOL;

    static {
        try {
            POOL = new CognitoStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void pool(DynamicPropertyRegistry registry) {
        registry.add("app.login.cognito-issuer", POOL::issuer);
    }

    @AfterAll
    static void stop() {
        POOL.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    UserRepository users;

    private static String unique(String name) {
        return name + "-" + System.nanoTime() + "@example.com";
    }

    /** Starts a session the way the frontend does after Cognito's sign-in returns. */
    private JsonNode startSession(String access, String id, String nativeLanguage, int status) throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("idToken", id, "nativeLanguage", nativeLanguage));
        var response = mvc.perform(post("/api/auth/cognito").header("Authorization", "Bearer " + access)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(status);
        String content = response.getContentAsString();
        return content.isEmpty() ? null : json.readTree(content);
    }

    private int meStatus(String access) throws Exception {
        return mvc.perform(get("/api/me").header("Authorization", "Bearer " + access)).andReturn().getResponse()
                .getStatus();
    }

    @Test
    void aFirstSignInCreatesALinkedAccountLikeSignUpDid() throws Exception {
        String sub = CognitoStub.newSub();
        String email = unique("Ana");

        JsonNode me = startSession(POOL.access(sub), POOL.id(sub, email), "es-ES", 200);

        assertThat(me.get("email").asString()).isEqualTo(email.toLowerCase());
        assertThat(me.get("displayName").asString()).isEqualTo(email.substring(0, email.indexOf('@')).toLowerCase());
        assertThat(me.get("nativeLanguage").asString()).isEqualTo("es");
        assertThat(me.get("tours").get("on").asBoolean()).isTrue();
        assertThat(me.get("plan").get("tier").asString()).isEqualTo("FREE");
        assertThat(users.findByCognitoSub(sub)).isPresent();

        JsonNode again = json.readTree(mvc.perform(get("/api/me").header("Authorization", "Bearer " + POOL.access(sub)))
                .andReturn().getResponse().getContentAsString());
        assertThat(again.get("id").asLong()).isEqualTo(me.get("id").asLong());
    }

    @Test
    void anExistingAccountWithTheSameEmailIsLinkedNotDuplicated() throws Exception {
        String email = unique("old");
        User existing = users.save(new User(email, "hash-from-before-cognito", "Old Timer"));
        String sub = CognitoStub.newSub();

        JsonNode me = startSession(POOL.access(sub), POOL.id(sub, email.toUpperCase()), "en", 200);

        assertThat(me.get("id").asLong()).isEqualTo(existing.getId());
        assertThat(me.get("displayName").asString()).isEqualTo("Old Timer");
        assertThat(users.findByCognitoSub(sub).map(User::getId)).contains(existing.getId());
    }

    @Test
    void anUnverifiedEmailIsRefusedAndNothingIsCreatedOrLinked() throws Exception {
        String email = unique("unverified");
        User existing = users.save(new User(email, "hash", "Someone"));
        String sub = CognitoStub.newSub();

        startSession(POOL.access(sub), POOL.id(sub, email, c -> c.claim("email_verified", false)), "en", 401);

        assertThat(users.findByCognitoSub(sub)).isEmpty();
        assertThat(users.findById(existing.getId()).orElseThrow().getCognitoSub()).isNull();
    }

    @Test
    void anIdTokenForSomeoneElseIsRefused() throws Exception {
        String sub = CognitoStub.newSub();
        startSession(POOL.access(sub), POOL.id(CognitoStub.newSub(), unique("other")), "en", 401);
        assertThat(users.findByCognitoSub(sub)).isEmpty();
    }

    @Test
    void aChangedEmailKeepsTheAccountLinkedByIdentity() throws Exception {
        String sub = CognitoStub.newSub();
        long id = startSession(POOL.access(sub), POOL.id(sub, unique("first")), "en", 200).get("id").asLong();

        JsonNode me = startSession(POOL.access(sub), POOL.id(sub, unique("second")), "en", 200);

        assertThat(me.get("id").asLong()).isEqualTo(id);
    }

    @Test
    void aSuspendedAccountIsToldItIsSuspended() throws Exception {
        String sub = CognitoStub.newSub();
        long id = startSession(POOL.access(sub), POOL.id(sub, unique("rule-breaker")), "en", 200).get("id").asLong();
        User user = users.findById(id).orElseThrow();
        user.setSuspended(true, "spam");
        users.save(user);

        JsonNode error = startSession(POOL.access(sub), POOL.id(sub, user.getEmail()), "en", 403);

        assertThat(error.get("code").asString()).isEqualTo("account_suspended");
    }

    @Test
    void onlyOurPoolsAccessTokensForOurClientSignIn() throws Exception {
        String sub = CognitoStub.newSub();
        startSession(POOL.access(sub), POOL.id(sub, unique("tokens")), "en", 200);
        assertThat(meStatus(POOL.access(sub))).isEqualTo(200);

        Instant past = Instant.now().minusSeconds(7200);
        assertThat(meStatus(POOL.access(sub, c -> c.issuer("https://cognito-idp.eu-west-1.amazonaws.com/other"))))
                .as("another pool").isEqualTo(401);
        assertThat(meStatus(POOL.access(sub, c -> c.claim("client_id", "another-client")))).as("another client")
                .isEqualTo(401);
        assertThat(meStatus(POOL.id(sub, "x@example.com"))).as("an ID token").isEqualTo(401);
        assertThat(meStatus(POOL.access(sub, c -> c.issueTime(Date.from(past))
                .expirationTime(Date.from(past.plusSeconds(3600)))))).as("expired").isEqualTo(401);
        assertThat(meStatus(POOL.forged(sub))).as("bad signature").isEqualTo(401);
        assertThat(meStatus(POOL.access(CognitoStub.newSub()))).as("never started a session").isEqualTo(401);
    }

    @Test
    void theOldPasswordEndpointsAndAutoLoginAreGoneAndOwnTokensAreRefused() throws Exception {
        String signup = "{\"email\":\"" + unique("pw") + "\",\"password\":\"password123\"}";
        assertThat(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signup))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(signup))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(post("/api/auth/dev-login")).andReturn().getResponse().getStatus()).isEqualTo(404);

        User someone = users.save(new User(unique("own-token"), "hash", "Someone"));
        assertThat(meStatus(ownTokens.issue(new AuthUser(someone.getId(), someone.getEmail())))).isEqualTo(401);
    }

    @Autowired
    JwtService ownTokens;
}
