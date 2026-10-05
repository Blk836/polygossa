package app.lector;

import static app.lector.PlaylistApiTest.create;
import static app.lector.PlaylistApiTest.itemIds;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import app.lector.writing.MutableClock;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Sharing playlists: who can see them, which of their items others see, and who can change them. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:playlistsharing;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class PlaylistSharingApiTest {

    static final MutableClock CLOCK = new MutableClock();

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String owner;
    String other;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        owner = api.signupPro();
        other = api.signupPro();
    }

    private void add(String token, long playlist, long text, int status) throws Exception {
        api.put(token, "/api/playlists/" + playlist + "/items/" + text, "", status);
    }

    private void share(long playlist) throws Exception {
        api.patch(owner, "/api/playlists/" + playlist, "{\"isPublic\":true}", 200);
    }

    /** A uniquely titled public playlist with one public text, so shared lists can be searched for it. */
    private long sharedPlaylist(String title) throws Exception {
        long p = create(api, owner, title, "fr");
        add(owner, p, api.createText(owner, "fr", "Un.", true), 204);
        share(p);
        return p;
    }

    private boolean listed(JsonNode list, long playlist) {
        for (JsonNode p : list) {
            if (p.get("id").asLong() == playlist) {
                return true;
            }
        }
        return false;
    }

    @Test
    void aPrivatePlaylistIsInvisibleToOthers() throws Exception {
        long p = create(api, owner, "Secret", "fr");
        add(owner, p, api.createText(owner, "fr", "Un.", true), 204);
        api.get(other, "/api/playlists/" + p, 404);
        assertThat(listed(api.get(other, "/api/playlists/shared?language=fr", 200), p)).isFalse();
        assertThat(listed(api.get(other, "/api/playlists", 200), p)).isFalse();
    }

    @Test
    void aSharedPlaylistCanBeOpenedAndIsListedForEveryone() throws Exception {
        long p = sharedPlaylist("Shared qzx");
        JsonNode d = api.get(other, "/api/playlists/" + p, 200);
        assertThat(d.get("playlist").get("mine").asBoolean()).isFalse();
        assertThat(d.get("playlist").get("owner").get("displayName").asString()).isNotBlank();
        assertThat(d.get("items")).hasSize(1);
        assertThat(listed(api.get(other, "/api/playlists/shared?language=fr", 200), p)).isTrue();
        assertThat(listed(api.get(other, "/api/playlists/shared?language=es", 200), p)).isFalse();
        assertThat(listed(api.get(other, "/api/playlists/shared", 200), p)).isTrue();
        assertThat(listed(api.get(other, "/api/playlists", 200), p)).isFalse();
    }

    @Test
    void sharedPlaylistsCanBeSearchedByTitle() throws Exception {
        long wanted = sharedPlaylist("Podcast épisodes Wqv");
        long unwanted = sharedPlaylist("Recettes Wqv");
        JsonNode found = api.send(get("/api/playlists/shared").param("q", " podcast ÉPISODES "), other, 200);
        assertThat(listed(found, wanted)).isTrue();
        assertThat(listed(found, unwanted)).isFalse();
    }

    @Test
    void unsharingHidesItAgain() throws Exception {
        long p = sharedPlaylist("Briefly shared");
        api.patch(owner, "/api/playlists/" + p, "{\"isPublic\":false}", 200);
        api.get(other, "/api/playlists/" + p, 404);
    }

    @Test
    void othersSeeOnlyTheItemsTheyCanReadAndTheOwnerIsToldWhichAreHidden() throws Exception {
        long p = create(api, owner, "Mixed", "fr");
        long shared = api.createText(owner, "fr", "Un.", true);
        long privateText = api.createText(owner, "fr", "Deux.", false);
        long alsoShared = api.createText(owner, "fr", "Trois.", true);
        add(owner, p, shared, 204);
        add(owner, p, privateText, 204);
        add(owner, p, alsoShared, 204);
        share(p);
        JsonNode theirs = api.get(other, "/api/playlists/" + p, 200);
        assertThat(itemIds(theirs)).containsExactly(shared, alsoShared);
        assertThat(theirs.get("playlist").get("covers")).hasSize(2);
        assertThat(theirs.get("playlist").get("covers").get(1).get("textId").asLong()).isEqualTo(alsoShared);
        assertThat(theirs.get("playlist").get("itemCount").asInt()).isEqualTo(2);
        assertThat(theirs.get("privateItems").asInt()).isZero();
        JsonNode mine = api.get(owner, "/api/playlists/" + p, 200);
        assertThat(itemIds(mine)).containsExactly(shared, privateText, alsoShared);
        assertThat(mine.get("playlist").get("itemCount").asInt()).isEqualTo(3);
        assertThat(mine.get("privateItems").asInt()).isEqualTo(1);
    }

    @Test
    void aSharedPlaylistWithNothingOthersCanReadIsNotListed() throws Exception {
        long p = create(api, owner, "Only private", "fr");
        add(owner, p, api.createText(owner, "fr", "Un.", false), 204);
        share(p);
        assertThat(listed(api.get(other, "/api/playlists/shared", 200), p)).isFalse();
        assertThat(api.get(other, "/api/playlists/" + p, 200).get("items")).isEmpty();
    }

    @Test
    void othersPublicTextsCanBeAddedButNotTheirPrivateOnes() throws Exception {
        long p = create(api, owner, "Mine", "fr");
        long theirPublic = api.createText(other, "fr", "Un.", true);
        long theirPrivate = api.createText(other, "fr", "Deux.", false);
        add(owner, p, theirPublic, 204);
        add(owner, p, theirPrivate, 404);
        assertThat(itemIds(api.get(owner, "/api/playlists/" + p, 200))).containsExactly(theirPublic);
    }

    @Test
    void onlyTheOwnerCanChangeASharedPlaylist() throws Exception {
        long p = sharedPlaylist("Look don't touch");
        long text = itemIds(api.get(owner, "/api/playlists/" + p, 200)).get(0);
        long theirs = api.createText(other, "fr", "Trois.", true);
        api.patch(other, "/api/playlists/" + p, "{\"title\":\"Mine now\"}", 403);
        add(other, p, theirs, 403);
        api.delete(other, "/api/playlists/" + p + "/items/" + text, 403);
        api.put(other, "/api/playlists/" + p + "/items", "{\"textIds\":[" + text + "]}", 403);
        api.delete(other, "/api/playlists/" + p, 403);
        JsonNode d = api.get(owner, "/api/playlists/" + p, 200);
        assertThat(d.get("playlist").get("title").asString()).isEqualTo("Look don't touch");
        assertThat(itemIds(d)).containsExactly(text);
    }

    @Test
    void othersCannotTouchAPrivatePlaylistAndAreToldItDoesNotExist() throws Exception {
        long p = create(api, owner, "Secret", "fr");
        api.patch(other, "/api/playlists/" + p, "{\"title\":\"x\"}", 404);
        api.delete(other, "/api/playlists/" + p, 404);
    }

    @Test
    void aTextThatStopsBeingSharedDropsOutOfOthersViewButStaysForItsOwner() throws Exception {
        long p = create(api, other, "Curated", "fr");
        long text = api.createText(owner, "fr", "Un.", true);
        add(other, p, text, 204);
        api.patch(other, "/api/playlists/" + p, "{\"isPublic\":true}", 200);
        api.patch(owner, "/api/texts/" + text, "{\"isPublic\":false}", 200);
        assertThat(api.get(other, "/api/playlists/" + p, 200).get("items")).isEmpty();
        api.patch(owner, "/api/texts/" + text, "{\"isPublic\":true}", 200);
        assertThat(itemIds(api.get(other, "/api/playlists/" + p, 200))).containsExactly(text);
    }

    @Test
    void progressInASharedPlaylistIsTheViewersOwn() throws Exception {
        long p = sharedPlaylist("Progress");
        long text = itemIds(api.get(owner, "/api/playlists/" + p, 200)).get(0);
        api.post(owner, "/api/texts/" + text + "/complete", "", 200);
        JsonNode theirs = api.get(other, "/api/playlists/" + p, 200);
        assertThat(theirs.get("playlist").get("completedCount").asInt()).isZero();
        assertThat(theirs.get("items").get(0).has("progress")).isFalse();
    }

    /** Shared playlists among {@code ids}, in the order the shared list gives them. */
    private List<Long> sharedOrder(long... ids) throws Exception {
        List<Long> order = new ArrayList<>();
        for (JsonNode p : api.get(other, "/api/playlists/shared?language=fr", 200)) {
            for (long id : ids) {
                if (p.get("id").asLong() == id) {
                    order.add(id);
                }
            }
        }
        return order;
    }

    @Test
    void sharedPlaylistsListTheMostRecentlyChangedFirst() throws Exception {
        long a = sharedPlaylist("Changed A");
        CLOCK.advance(Duration.ofMinutes(1));
        long b = sharedPlaylist("Changed B");
        add(owner, b, api.createText(owner, "fr", "Deux.", true), 204);
        assertThat(sharedOrder(a, b)).containsExactly(b, a);

        CLOCK.advance(Duration.ofMinutes(1));
        long extra = api.createText(owner, "fr", "Trois.", true);
        add(owner, a, extra, 204);
        assertThat(sharedOrder(a, b)).containsExactly(a, b);

        CLOCK.advance(Duration.ofMinutes(1));
        JsonNode renamed = api.patch(owner, "/api/playlists/" + b, "{\"title\":\"Changed B2\"}", 200);
        assertThat(renamed.get("updatedAt").asString()).isEqualTo(CLOCK.instant().toString());
        assertThat(sharedOrder(a, b)).containsExactly(b, a);

        CLOCK.advance(Duration.ofMinutes(1));
        api.delete(owner, "/api/playlists/" + a + "/items/" + extra, 204);
        assertThat(sharedOrder(a, b)).containsExactly(a, b);

        CLOCK.advance(Duration.ofMinutes(1));
        List<Long> items = itemIds(api.get(owner, "/api/playlists/" + b, 200));
        api.put(owner, "/api/playlists/" + b + "/items", "{\"textIds\":[" + items.get(1) + "," + items.get(0) + "]}", 204);
        assertThat(sharedOrder(a, b)).containsExactly(b, a);
        JsonNode first = api.get(other, "/api/playlists/" + a, 200).get("playlist");
        assertThat(first.get("createdAt").asString()).isNotBlank();
    }

    @Test
    void itemsTheOwnerCanNoLongerReadKeepTheirPlaceAfterAReorder() throws Exception {
        long p = create(api, owner, "Curated", "fr");
        long a = api.createText(owner, "fr", "Un.", false);
        long theirs = api.createText(other, "fr", "Deux.", true);
        long b = api.createText(owner, "fr", "Trois.", false);
        add(owner, p, theirs, 204);
        add(owner, p, a, 204);
        add(owner, p, b, 204);
        api.patch(other, "/api/texts/" + theirs, "{\"isPublic\":false}", 200);
        assertThat(itemIds(api.get(owner, "/api/playlists/" + p, 200))).containsExactly(a, b);
        api.put(owner, "/api/playlists/" + p + "/items", "{\"textIds\":[" + b + "," + a + "]}", 204);
        api.patch(other, "/api/texts/" + theirs, "{\"isPublic\":true}", 200);
        assertThat(itemIds(api.get(owner, "/api/playlists/" + p, 200))).containsExactly(b, a, theirs);
    }

    @Test
    void requiresSignIn() throws Exception {
        api.get(null, "/api/playlists", 401);
    }
}
