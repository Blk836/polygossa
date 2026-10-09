package app.lector;

import static app.lector.PlaylistApiTest.create;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class PlaylistBookmarkApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String me;
    String owner;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
        owner = api.signupPro();
    }

    private long shared(String title, String language) throws Exception {
        long p = create(api, owner, title, language);
        api.put(owner, "/api/playlists/" + p + "/items/" + api.createText(owner, language, "Un.", true), "", 204);
        api.patch(owner, "/api/playlists/" + p, "{\"isPublic\":true}", 200);
        return p;
    }

    private void save(String token, long playlist, int status) throws Exception {
        api.put(token, "/api/playlists/" + playlist + "/bookmark", "", status);
    }

    private void unsave(String token, long playlist) throws Exception {
        api.delete(token, "/api/playlists/" + playlist + "/bookmark", 204);
    }

    private static List<Long> ids(JsonNode list) {
        List<Long> ids = new ArrayList<>();
        list.forEach(p -> ids.add(p.get("id").asLong()));
        return ids;
    }

    private List<Long> saved(String token, String query) throws Exception {
        return ids(api.get(token, "/api/playlists/saved" + query, 200));
    }

    private static JsonNode find(JsonNode list, long playlist) {
        for (JsonNode p : list) {
            if (p.get("id").asLong() == playlist) {
                return p;
            }
        }
        throw new AssertionError("playlist " + playlist + " not listed");
    }

    @Test
    void savingASharedPlaylistMarksItEverywhereAndListsItUnderSaved() throws Exception {
        long p = shared("Podcast", "fr");
        save(me, p, 204);
        JsonNode list = api.get(me, "/api/playlists/saved", 200);
        assertThat(ids(list)).containsExactly(p);
        assertThat(find(list, p).get("bookmarked").asBoolean()).isTrue();
        assertThat(find(api.get(me, "/api/playlists/shared", 200), p).get("bookmarked").asBoolean()).isTrue();
        assertThat(api.get(me, "/api/playlists/" + p, 200).get("playlist").get("bookmarked").asBoolean()).isTrue();
    }

    @Test
    void savingTwiceIsANoOpAndUnsavingRemovesIt() throws Exception {
        long p = shared("Podcast", "fr");
        save(me, p, 204);
        save(me, p, 204);
        assertThat(saved(me, "")).containsExactly(p);
        unsave(me, p);
        assertThat(saved(me, "")).isEmpty();
        assertThat(find(api.get(me, "/api/playlists/shared", 200), p).get("bookmarked").asBoolean()).isFalse();
        unsave(me, p);
    }

    @Test
    void playlistsNotSavedSaySo() throws Exception {
        long theirs = shared("Podcast", "fr");
        long mine = create(api, me, "Mine", "fr");
        assertThat(find(api.get(me, "/api/playlists/shared", 200), theirs).get("bookmarked").asBoolean()).isFalse();
        assertThat(find(api.get(me, "/api/playlists", 200), mine).get("bookmarked").asBoolean()).isFalse();
        assertThat(api.get(me, "/api/playlists/" + theirs, 200).get("playlist").get("bookmarked").asBoolean()).isFalse();
    }

    @Test
    void savedListsTheNewestSaveFirstFollowsTheLanguageAndIsPerUser() throws Exception {
        long podcast = shared("Podcast", "fr");
        long recetas = shared("Recetas", "es");
        save(me, podcast, 204);
        save(me, recetas, 204);
        assertThat(saved(me, "")).containsExactly(recetas, podcast);
        assertThat(saved(me, "?language=fr")).containsExactly(podcast);
        assertThat(saved(owner, "")).isEmpty();
    }

    @Test
    void someoneElsesPrivatePlaylistOrAMissingOneCannotBeSaved() throws Exception {
        long secret = create(api, owner, "Secret", "fr");
        save(me, secret, 404);
        save(me, 999_999, 404);
        assertThat(saved(me, "")).isEmpty();
    }

    @Test
    void myOwnPlaylistCanBeSaved() throws Exception {
        long mine = create(api, me, "Mine", "fr");
        save(me, mine, 204);
        assertThat(saved(me, "")).containsExactly(mine);
    }

    @Test
    void aSavedPlaylistThatStopsBeingSharedDropsOutUntilSharedAgain() throws Exception {
        long p = shared("Podcast", "fr");
        save(me, p, 204);
        api.patch(owner, "/api/playlists/" + p, "{\"isPublic\":false}", 200);
        assertThat(saved(me, "")).isEmpty();
        api.patch(owner, "/api/playlists/" + p, "{\"isPublic\":true}", 200);
        assertThat(saved(me, "")).containsExactly(p);
    }

    @Test
    void deletingASavedPlaylistTakesItOutOfSaved() throws Exception {
        long p = shared("Podcast", "fr");
        save(me, p, 204);
        save(owner, p, 204);
        api.delete(owner, "/api/playlists/" + p, 204);
        assertThat(saved(me, "")).isEmpty();
        assertThat(saved(owner, "")).isEmpty();
    }

    @Test
    void requiresSignIn() throws Exception {
        api.get(null, "/api/playlists/saved", 401);
        api.put(null, "/api/playlists/1/bookmark", "", 401);
    }
}
