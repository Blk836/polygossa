package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.user.LibraryAccount;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AdminApiTest {

    static final String ADMIN = "forum-admin@test.co";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    LibraryAccount library;

    @Autowired
    app.lector.user.UserRepository users;

    private TestApi api;
    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        admin = admin();
    }

    private String admin() throws Exception {
        String body = "{\"email\":\"" + ADMIN + "\",\"password\":\"password123\"}";
        var signup = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse();
        String reply = signup.getStatus() == 201 ? signup.getContentAsString()
                : mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reply).get("token").asString();
    }

    private record Learner(String token, long id, String email) {}

    private Learner learner(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID() + "@test.co";
        JsonNode r = api.post(null, "/api/auth/signup", "{\"email\":\"" + email + "\",\"password\":\"password123\","
                + "\"displayName\":\"" + name + "\"}", 201);
        return new Learner("Bearer " + r.get("token").asString(), r.get("user").get("id").asLong(), email);
    }

    private JsonNode stats() throws Exception {
        return api.get(admin, "/api/admin/stats", 200);
    }

    @Test
    void onlyAdmins() throws Exception {
        Learner l = learner("plain");
        for (String path : List.of("/api/admin/stats", "/api/admin/users", "/api/admin/users/" + l.id(),
                "/api/admin/actions", "/api/admin/translations")) {
            assertThat(api.get(l.token(), path, 403).get("code").asString()).isEqualTo("forbidden");
        }
        api.post(l.token(), "/api/admin/users/" + l.id() + "/suspend", "{\"reason\":\"x\"}", 403);
        api.delete(l.token(), "/api/admin/users/" + l.id() + "/posts", 403);
        assertThat(api.get(l.token(), "/api/me", 200).get("admin").asBoolean()).isFalse();
        assertThat(api.get(admin, "/api/me", 200).get("admin").asBoolean()).isTrue();
    }

    @Test
    void lookupCostsUseGpt4oMiniPricesUnlessConfigured() throws Exception {
        JsonNode prices = api.get(admin, "/api/admin/translations", 200).get("prices");
        assertThat(prices.has("translatePerMillionCharacters")).isFalse();
        assertThat(prices.get("aiInputPerMillionTokens").asDouble()).isEqualTo(0.15);
        assertThat(prices.get("aiOutputPerMillionTokens").asDouble()).isEqualTo(0.6);
    }

    @Test
    void usersPerPlanSignUpsAndActiveUsers() throws Exception {
        JsonNode before = stats();
        Learner free = learner("free");
        Learner pro = learner("pro");
        api.post(pro.token(), "/api/me/plan", "{\"tier\":\"PRO\"}", 200);
        api.get(free.token(), "/api/me", 200);
        JsonNode after = stats();

        assertThat(after.get("users").get("total").asLong()).isEqualTo(before.get("users").get("total").asLong() + 2);
        assertThat(after.get("users").get("perPlan").get("free").asLong())
                .isEqualTo(before.get("users").get("perPlan").get("free").asLong() + 1);
        assertThat(after.get("users").get("perPlan").get("pro").asLong())
                .isEqualTo(before.get("users").get("perPlan").get("pro").asLong() + 1);
        assertThat(after.get("users").get("newToday").asLong())
                .isEqualTo(before.get("users").get("newToday").asLong() + 2);
        assertThat(after.get("activeToday").asLong()).isEqualTo(before.get("activeToday").asLong() + 2);
        assertThat(after.get("active7").asLong()).isGreaterThanOrEqualTo(after.get("activeToday").asLong());
        assertThat(after.get("active30").asLong()).isGreaterThanOrEqualTo(after.get("active7").asLong());

        List<JsonNode> active = after.get("active").valueStream().toList();
        assertThat(active).hasSize(30);
        assertThat(active.getLast().get("value").asLong()).isEqualTo(after.get("activeToday").asLong());
        List<JsonNode> signups = after.get("signups").valueStream().toList();
        assertThat(signups).hasSize(30);
        assertThat(signups.getLast().get("value").asLong()).isEqualTo(after.get("users").get("newToday").asLong());
        assertThat(signups.getFirst().get("day").asString()).isLessThan(signups.getLast().get("day").asString());
    }

    @Test
    void learningAndContentFigures() throws Exception {
        JsonNode before = stats();
        Learner l = learner("content");
        api.patch(l.token(), "/api/me", "{\"targetLanguage\":\"de\"}", 200);
        api.createText(l.token(), "de", "Hallo Welt.", true);
        api.createText(l.token(), "de", "Privat.", false);
        api.post(l.token(), "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"Hello all\",\"body\":\"Hello\"}", 201);
        api.post(l.token(), "/api/vocabulary", "{\"language\":\"de\",\"term\":\"hallo\"}", 201);
        JsonNode after = stats();
        JsonNode c0 = before.get("content");
        JsonNode c1 = after.get("content");
        assertThat(c1.get("texts").asLong()).isEqualTo(c0.get("texts").asLong() + 2);
        assertThat(c1.get("publicTexts").asLong()).isEqualTo(c0.get("publicTexts").asLong() + 1);
        assertThat(c1.get("forumThreads").asLong()).isEqualTo(c0.get("forumThreads").asLong() + 1);
        assertThat(c1.get("forumPosts").asLong()).isEqualTo(c0.get("forumPosts").asLong() + 1);
        assertThat(c1.get("savedWords").asLong()).isEqualTo(c0.get("savedWords").asLong() + 1);
        for (String field : List.of("videos", "playlists", "reviewsToday", "wordsReadToday", "aiCallsToday")) {
            assertThat(c1.has(field)).as(field).isTrue();
        }
        assertThat(after.get("languages").valueStream()
                .filter(n -> n.get("language").asString().equals("de")).findFirst().orElseThrow()
                .get("users").asLong()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void daysToShow() throws Exception {
        JsonNode week = api.get(admin, "/api/admin/stats?days=7", 200);
        assertThat(week.get("active")).hasSize(7);
        assertThat(week.get("signups")).hasSize(7);
        api.get(admin, "/api/admin/stats?days=0", 400);
        api.get(admin, "/api/admin/stats?days=366", 400);
    }

    @Test
    void findingUsersAndTheirDetails() throws Exception {
        String tag = "zq" + UUID.randomUUID().toString().substring(0, 8);
        Learner a = learner(tag + "ana");
        Learner b = learner(tag + "bob");
        long text = api.createText(a.token(), "es", "Hola.", true);
        long playlist = api.post(a.token(), "/api/playlists", "{\"title\":\"Mine\",\"language\":\"es\"}", 201)
                .get("id").asLong();

        JsonNode found = api.get(admin, "/api/admin/users?q=" + tag + "ana", 200);
        assertThat(found.get("total").asLong()).isEqualTo(1);
        JsonNode row = found.get("items").get(0);
        assertThat(row.get("id").asLong()).isEqualTo(a.id());
        assertThat(row.get("email").asString()).isEqualTo(a.email());
        assertThat(row.get("plan").asString()).isEqualTo("FREE");
        assertThat(row.get("suspended").asBoolean()).isFalse();
        assertThat(row.get("admin").asBoolean()).isFalse();
        assertThat(row.get("texts").asLong()).isEqualTo(1);
        assertThat(row.get("playlists").asLong()).isEqualTo(1);
        assertThat(row.get("posts").asLong()).isZero();
        assertThat(row.has("createdAt")).isTrue();
        assertThat(row.get("lastActive").asString()).isNotBlank();

        JsonNode both = api.get(admin, "/api/admin/users?q=" + tag, 200);
        assertThat(both.get("items").valueStream().map(n -> n.get("id").asLong())).containsExactly(b.id(), a.id());

        JsonNode detail = api.get(admin, "/api/admin/users/" + a.id(), 200);
        assertThat(detail.get("user").get("email").asString()).isEqualTo(a.email());
        assertThat(detail.get("texts").get(0).get("id").asLong()).isEqualTo(text);
        assertThat(detail.get("texts").get(0).get("isPublic").asBoolean()).isTrue();
        assertThat(detail.get("playlists").get(0).get("id").asLong()).isEqualTo(playlist);
        api.get(admin, "/api/admin/users/999999999", 404);
    }

    @Test
    void suspendingAndLiftingASuspension() throws Exception {
        Learner l = learner("spammer");
        long text = api.createText(l.token(), "es", "Compra ahora.", true);
        JsonNode s = api.post(admin, "/api/admin/users/" + l.id() + "/suspend", "{\"reason\":\"spam\"}", 200);
        assertThat(s.get("suspended").asBoolean()).isTrue();
        assertThat(api.get(admin, "/api/admin/users/" + l.id(), 200).get("suspendedReason").asString())
                .isEqualTo("spam");

        assertThat(api.get(l.token(), "/api/me", 403).get("code").asString()).isEqualTo("account_suspended");
        assertThat(api.get(l.token(), "/api/library", 403).get("code").asString()).isEqualTo("account_suspended");
        assertThat(api.post(null, "/api/auth/login", "{\"email\":\"" + l.email() + "\",\"password\":\"password123\"}",
                403).get("code").asString()).isEqualTo("account_suspended");
        assertThat(api.get(admin, "/api/texts/" + text, 200).get("text").get("id").asLong()).isEqualTo(text);

        api.post(admin, "/api/admin/users/" + l.id() + "/unsuspend", "", 200);
        api.get(l.token(), "/api/me", 200);
        api.post(null, "/api/auth/login", "{\"email\":\"" + l.email() + "\",\"password\":\"password123\"}", 200);
    }

    @Test
    void adminsAndTheLibraryCantBeSuspended() throws Exception {
        long me = api.get(admin, "/api/me", 200).get("id").asLong();
        boolean existed = library.find().isPresent();
        app.lector.user.User lib = library.getOrCreate();
        try {
            api.post(admin, "/api/admin/users/" + me + "/suspend", "{\"reason\":\"x\"}", 400);
            api.post(admin, "/api/admin/users/" + lib.getId() + "/suspend", "{\"reason\":\"x\"}", 400);
            api.get(admin, "/api/me", 200);
            api.delete(admin, "/api/admin/users/" + lib.getId() + "/texts", 400);
            api.delete(admin, "/api/admin/users/" + lib.getId() + "/playlists", 400);
        } finally {
            if (!existed) {
                users.delete(lib);
            }
        }
    }

    @Test
    void removingAllForumPostsByAUser() throws Exception {
        Learner troll = learner("troll");
        Learner other = learner("other");
        long own = api.post(troll.token(), "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"Mine\",\"body\":\"Bad\"}", 201).get("id").asLong();
        api.post(other.token(), "/api/forum/threads/" + own + "/posts", "{\"body\":\"A reply\"}", 201);
        long theirs = api.post(other.token(), "/api/forum/threads",
                "{\"category\":\"general\",\"title\":\"Theirs\",\"body\":\"Good\"}", 201).get("id").asLong();
        api.post(troll.token(), "/api/forum/threads/" + theirs + "/posts", "{\"body\":\"Bad reply\"}", 201);

        JsonNode removed = api.delete(admin, "/api/admin/users/" + troll.id() + "/posts", 200);
        assertThat(removed.get("posts").asInt()).isEqualTo(2);
        assertThat(removed.get("threads").asInt()).isEqualTo(1);
        api.get(other.token(), "/api/forum/threads/" + own, 404);
        JsonNode kept = api.get(other.token(), "/api/forum/threads/" + theirs, 200);
        assertThat(kept.get("posts")).hasSize(1);
        assertThat(kept.get("thread").get("replies").asInt()).isZero();
    }

    @Test
    void removingAllPlaylistsAndAllContentByAUser() throws Exception {
        Learner l = learner("uploader");
        Learner reader = learner("reader");
        long text = api.createText(l.token(), "es", "Hola amigo.", true);
        long video = api.createText(l.token(), "es", "Otro texto.", false);
        long playlist = api.post(l.token(), "/api/playlists", "{\"title\":\"P\",\"language\":\"es\"}", 201)
                .get("id").asLong();
        api.put(l.token(), "/api/playlists/" + playlist + "/items/" + text, "", 204);
        long word = api.post(reader.token(), "/api/vocabulary",
                "{\"language\":\"es\",\"term\":\"amigo\",\"textId\":" + text + "}", 201).get("id").asLong();

        assertThat(api.delete(admin, "/api/admin/users/" + l.id() + "/playlists", 200).get("playlists").asInt())
                .isEqualTo(1);
        api.get(l.token(), "/api/playlists/" + playlist, 404);
        api.get(l.token(), "/api/texts/" + text, 200);

        assertThat(api.delete(admin, "/api/admin/users/" + l.id() + "/texts", 200).get("texts").asInt()).isEqualTo(2);
        api.get(l.token(), "/api/texts/" + text, 404);
        api.get(l.token(), "/api/texts/" + video, 404);
        assertThat(api.get(reader.token(), "/api/vocabulary/" + word, 200).get("term").asString()).isEqualTo("amigo");
    }

    @Test
    void unsharingEverythingAndRemovingOneText() throws Exception {
        Learner l = learner("sharer");
        long a = api.createText(l.token(), "es", "Uno.", true);
        long b = api.createText(l.token(), "es", "Dos.", true);
        long playlist = api.post(l.token(), "/api/playlists", "{\"title\":\"P\",\"language\":\"es\"}", 201)
                .get("id").asLong();
        api.patch(l.token(), "/api/playlists/" + playlist, "{\"isPublic\":true}", 200);

        JsonNode unshared = api.post(admin, "/api/admin/users/" + l.id() + "/unshare", "", 200);
        assertThat(unshared.get("texts").asInt()).isEqualTo(2);
        assertThat(unshared.get("playlists").asInt()).isEqualTo(1);
        JsonNode detail = api.get(admin, "/api/admin/users/" + l.id(), 200);
        assertThat(detail.get("texts").valueStream().map(t -> t.get("isPublic").asBoolean())).containsOnly(false);
        assertThat(detail.get("playlists").get(0).get("isPublic").asBoolean()).isFalse();
        Learner viewer = learner("viewer");
        api.get(viewer.token(), "/api/texts/" + a, 404);

        api.delete(admin, "/api/admin/texts/" + a, 204);
        api.get(l.token(), "/api/texts/" + a, 404);
        api.get(l.token(), "/api/texts/" + b, 200);
        api.delete(admin, "/api/admin/texts/999999999", 404);
    }

    @Test
    void changingAPlanAndTheRecordOfActions() throws Exception {
        Learner l = learner("upgrade");
        assertThat(api.post(admin, "/api/admin/users/" + l.id() + "/plan", "{\"tier\":\"PRO\"}", 200)
                .get("plan").asString()).isEqualTo("PRO");
        assertThat(api.get(l.token(), "/api/me", 200).get("plan").get("tier").asString()).isEqualTo("PRO");
        api.post(admin, "/api/admin/users/" + l.id() + "/suspend", "{\"reason\":\"testing\"}", 200);

        List<JsonNode> actions = api.get(admin, "/api/admin/actions", 200).valueStream().toList();
        JsonNode latest = actions.getFirst();
        assertThat(latest.get("action").asString()).isEqualTo("suspend");
        assertThat(latest.get("admin").asString()).isEqualTo(ADMIN);
        assertThat(latest.get("target").asString()).isEqualTo(l.email());
        assertThat(latest.get("detail").asString()).isEqualTo("testing");
        assertThat(latest.has("at")).isTrue();
        assertThat(actions.get(1).get("action").asString()).isEqualTo("plan");
        assertThat(actions.get(1).get("detail").asString()).isEqualTo("PRO");
    }
}
