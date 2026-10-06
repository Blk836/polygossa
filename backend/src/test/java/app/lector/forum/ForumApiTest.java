package app.lector.forum;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.ApiTest;
import app.lector.TestApi;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: Forum (docs/acceptance/forum.feature). The admin is {@link #ADMIN}, named in the test properties; other
 * forum tests share the database, so assertions look at this test's own threads.
 */
@ApiTest
class ForumApiTest {

    static final String ADMIN = "forum-admin@test.co";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String me;
    String other;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signup();
        other = api.signup();
    }

    /** Signs the admin up the first time, and in after that. */
    private String admin() throws Exception {
        String body = "{\"email\":\"" + ADMIN + "\",\"password\":\"password123\"}";
        var signup = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse();
        String reply = signup.getStatus() == 201 ? signup.getContentAsString()
                : mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reply).get("token").asString();
    }

    private static String title() {
        return "T " + UUID.randomUUID();
    }

    private static String q(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private JsonNode thread(String user, String category, String title, String body, int status) throws Exception {
        return api.post(user, "/api/forum/threads", "{\"category\":" + (category == null ? "null" : q(category))
                + ",\"title\":" + q(title) + ",\"body\":" + q(body) + "}", status);
    }

    private long thread(String user, String category) throws Exception {
        return thread(user, category, title(), "Hello", 201).get("id").asLong();
    }

    private JsonNode reply(String user, long thread, String body, int status) throws Exception {
        return api.post(user, "/api/forum/threads/" + thread + "/posts", "{\"body\":" + q(body) + "}", status);
    }

    private JsonNode show(String user, long thread) throws Exception {
        return api.get(user, "/api/forum/threads/" + thread, 200);
    }

    private static List<Long> ids(JsonNode list) {
        List<Long> ids = new ArrayList<>();
        list.get("threads").forEach(t -> ids.add(t.get("id").asLong()));
        return ids;
    }

    private static JsonNode summary(JsonNode list, long id) {
        for (JsonNode t : list.get("threads")) {
            if (t.get("id").asLong() == id) {
                return t;
            }
        }
        return null;
    }

    // ---- Posting ----

    @Test
    void startingAThreadShowsMyFirstPost() throws Exception {
        String title = title();
        JsonNode created = thread(me, "bugs", title, "It crashes", 201);
        assertThat(created.get("category").asString()).isEqualTo("bugs");
        assertThat(created.get("title").asString()).isEqualTo(title);
        assertThat(created.get("replies").asInt()).isZero();
        assertThat(created.get("pinned").asBoolean()).isFalse();
        assertThat(created.get("locked").asBoolean()).isFalse();
        JsonNode shown = show(other, created.get("id").asLong());
        assertThat(shown.get("thread").get("title").asString()).isEqualTo(title);
        assertThat(shown.get("posts")).hasSize(1);
        JsonNode first = shown.get("posts").get(0);
        assertThat(first.get("body").asString()).isEqualTo("It crashes");
        assertThat(first.get("author").get("name").asString()).isNotBlank();
        assertThat(first.get("createdAt").isNull()).isFalse();
        assertThat(first.get("mine").asBoolean()).isFalse();
        assertThat(show(me, created.get("id").asLong()).get("posts").get(0).get("mine").asBoolean()).isTrue();
        assertThat(shown.get("canModerate").asBoolean()).isFalse();
    }

    @Test
    void replyingBumpsTheThread() throws Exception {
        long older = thread(me, "general");
        long newer = thread(me, "general");
        assertThat(ids(api.get(me, "/api/forum/threads?category=general", 200))).containsSubsequence(newer, older);
        JsonNode r = reply(other, older, "Me too", 201);
        assertThat(r.get("body").asString()).isEqualTo("Me too");
        JsonNode list = api.get(me, "/api/forum/threads?category=general", 200);
        assertThat(ids(list)).containsSubsequence(older, newer);
        assertThat(summary(list, older).get("replies").asInt()).isEqualTo(1);
        JsonNode shown = show(me, older);
        assertThat(shown.get("posts")).hasSize(2);
        assertThat(shown.get("posts").get(1).get("body").asString()).isEqualTo("Me too");
    }

    @Test
    void postsAreKeptExactlyAsTyped() throws Exception {
        long t = thread(me, "general");
        reply(me, t, "<b>hi</b>\n\nsecond line", 201);
        assertThat(show(me, t).get("posts").get(1).get("body").asString()).isEqualTo("<b>hi</b>\n\nsecond line");
    }

    @Test
    void invalidPostsAreRejected() throws Exception {
        thread(me, "bugs", "ab", "x", 400);
        thread(me, "bugs", "x".repeat(121), "x", 400);
        thread(me, "bugs", "   ", "x", 400);
        thread(me, "bugs", title(), "   ", 400);
        thread(me, "bugs", title(), "x".repeat(10_001), 400);
        thread(me, null, title(), "x", 400);
        thread(me, "chitchat", title(), "x", 400);
        long t = thread(me, "bugs", "abc", "x".repeat(10_000), 201).get("id").asLong();
        reply(me, t, "", 400);
        reply(me, t, " \n ", 400);
        reply(me, t, "x".repeat(10_001), 400);
        assertThat(show(me, t).get("posts")).hasSize(1);
    }

    @Test
    void threadsArePagedTwentyAtATime() throws Exception {
        for (int i = 0; i < 21; i++) {
            thread(me, "ideas");
        }
        JsonNode first = api.get(me, "/api/forum/threads?category=ideas", 200);
        assertThat(first.get("threads")).hasSize(20);
        assertThat(first.get("total").asLong()).isGreaterThanOrEqualTo(21);
        JsonNode second = api.get(me, "/api/forum/threads?category=ideas&page=1", 200);
        assertThat(second.get("threads")).isNotEmpty();
        assertThat(ids(second)).doesNotContainAnyElementsOf(ids(first));
        api.get(me, "/api/forum/threads?page=-1", 400);
        api.get(me, "/api/forum/threads?category=chitchat", 400);
    }

    @Test
    void allListsEveryCategory() throws Exception {
        long bug = thread(me, "bugs");
        long idea = thread(me, "ideas");
        JsonNode all = api.get(me, "/api/forum/threads", 200);
        assertThat(ids(all)).contains(bug, idea);
        assertThat(ids(api.get(me, "/api/forum/threads?category=bugs", 200))).contains(bug).doesNotContain(idea);
    }

    @Test
    void longThreadsArePagedFiftyAtATimeOldestFirst() throws Exception {
        long t = thread(me, "general");
        for (int i = 1; i < 120; i++) {
            reply(me, t, "Post " + i, 201);
        }
        JsonNode p0 = show(me, t);
        assertThat(p0.get("posts")).hasSize(50);
        assertThat(p0.get("total").asInt()).isEqualTo(120);
        JsonNode p2 = api.get(me, "/api/forum/threads/" + t + "?page=2", 200);
        assertThat(p2.get("posts")).hasSize(20);
        assertThat(p2.get("posts").get(19).get("body").asString()).isEqualTo("Post 119");
        assertThat(p0.get("posts").get(1).get("body").asString()).isEqualTo("Post 1");
    }

    // ---- Editing and deleting ----

    @Test
    void iCanEditOnlyMyOwnPosts() throws Exception {
        long t = thread(me, "general");
        long post = show(me, t).get("posts").get(0).get("id").asLong();
        JsonNode edited = api.patch(me, "/api/forum/posts/" + post, "{\"body\":\"Fixed typo\"}", 200);
        assertThat(edited.get("body").asString()).isEqualTo("Fixed typo");
        assertThat(edited.get("editedAt").isNull()).isFalse();
        api.patch(other, "/api/forum/posts/" + post, "{\"body\":\"Mine now\"}", 403);
        api.patch(me, "/api/forum/posts/" + post, "{\"body\":\"  \"}", 400);
        api.patch(admin(), "/api/forum/posts/" + post, "{\"body\":\"Admin edit\"}", 403);
        assertThat(show(me, t).get("posts").get(0).get("body").asString()).isEqualTo("Fixed typo");
    }

    @Test
    void deletingMyReplyLowersTheCount() throws Exception {
        long t = thread(me, "general");
        long r = reply(me, t, "Oops", 201).get("id").asLong();
        long kept = reply(other, t, "Stay", 201).get("id").asLong();
        api.delete(other, "/api/forum/posts/" + r, 403);
        api.delete(me, "/api/forum/posts/" + kept, 403);
        api.delete(me, "/api/forum/posts/" + r, 204);
        JsonNode shown = show(me, t);
        assertThat(shown.get("posts")).hasSize(2);
        assertThat(shown.get("thread").get("replies").asInt()).isEqualTo(1);
    }

    @Test
    void deletingTheFirstPostDeletesTheThread() throws Exception {
        long t = thread(me, "general");
        long reply = reply(other, t, "A reply", 201).get("id").asLong();
        long first = show(me, t).get("posts").get(0).get("id").asLong();
        api.delete(me, "/api/forum/posts/" + first, 204);
        api.get(me, "/api/forum/threads/" + t, 404);
        api.delete(other, "/api/forum/posts/" + reply, 404);
        assertThat(ids(api.get(me, "/api/forum/threads?category=general", 200))).doesNotContain(t);
    }

    // ---- Admins ----

    @Test
    void onlyAdminsStartAnnouncementsButAnyoneReplies() throws Exception {
        thread(me, "announcements", title(), "Hi all", 403);
        String admin = admin();
        long a = thread(admin, "announcements");
        reply(me, a, "Thanks!", 201);
        assertThat(api.get(admin, "/api/forum/threads?category=announcements", 200).get("canModerate").asBoolean())
                .isTrue();
        assertThat(api.get(me, "/api/forum/threads", 200).get("canModerate").asBoolean()).isFalse();
    }

    @Test
    void pinnedThreadsComeFirst() throws Exception {
        String admin = admin();
        long pinned = thread(me, "general");
        long later = thread(me, "general");
        JsonNode p = api.patch(admin, "/api/forum/threads/" + pinned, "{\"pinned\":true}", 200);
        assertThat(p.get("pinned").asBoolean()).isTrue();
        try {
            assertThat(ids(api.get(me, "/api/forum/threads?category=general", 200))).containsSubsequence(pinned, later);
            assertThat(ids(api.get(me, "/api/forum/threads", 200))).containsSubsequence(pinned, later);
        } finally {
            api.patch(admin, "/api/forum/threads/" + pinned, "{\"pinned\":false}", 200);
        }
        assertThat(ids(api.get(me, "/api/forum/threads?category=general", 200))).containsSubsequence(later, pinned);
    }

    @Test
    void lockedThreadsTakeNoReplies() throws Exception {
        String admin = admin();
        long t = thread(me, "bugs");
        JsonNode locked = api.patch(admin, "/api/forum/threads/" + t, "{\"locked\":true}", 200);
        assertThat(locked.get("locked").asBoolean()).isTrue();
        assertThat(locked.get("pinned").asBoolean()).isFalse();
        reply(me, t, "But wait", 409);
        reply(admin, t, "Closing this", 409);
        api.patch(admin, "/api/forum/threads/" + t, "{\"locked\":false}", 200);
        reply(me, t, "Thanks", 201);
    }

    @Test
    void onlyAdminsPinOrLock() throws Exception {
        long t = thread(me, "bugs");
        api.patch(me, "/api/forum/threads/" + t, "{\"pinned\":true}", 403);
        api.patch(me, "/api/forum/threads/" + t, "{\"locked\":true}", 403);
        assertThat(show(me, t).get("thread").get("pinned").asBoolean()).isFalse();
    }

    @Test
    void adminsDeleteAnything() throws Exception {
        String admin = admin();
        long t = thread(me, "general");
        long r = reply(other, t, "spam", 201).get("id").asLong();
        api.delete(admin, "/api/forum/posts/" + r, 204);
        long first = show(me, t).get("posts").get(0).get("id").asLong();
        api.delete(admin, "/api/forum/posts/" + first, 204);
        api.get(me, "/api/forum/threads/" + t, 404);
    }

    @Test
    void missingThreadsAndPostsAre404() throws Exception {
        api.get(me, "/api/forum/threads/999999999", 404);
        reply(me, 999_999_999L, "Hi", 404);
        api.patch(me, "/api/forum/posts/999999999", "{\"body\":\"x\"}", 404);
        api.delete(me, "/api/forum/posts/999999999", 404);
        api.patch(admin(), "/api/forum/threads/999999999", "{\"pinned\":true}", 404);
    }
}
