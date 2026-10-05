package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.playlist.Playlist;
import app.lector.playlist.PlaylistItem;
import app.lector.playlist.PlaylistItemRepository;
import app.lector.playlist.PlaylistRepository;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** A learner's own playlists: creating them, adding, ordering and removing items. Sharing is in PlaylistSharingApiTest. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:playlists;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class PlaylistApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    @Autowired
    UserRepository users;

    @Autowired
    PlaylistRepository playlists;

    @Autowired
    PlaylistItemRepository items;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro(); // past the free plan's five-text limit
    }

    static long create(TestApi api, String token, String title, String language) throws Exception {
        return api.post(token, "/api/playlists", "{\"title\":\"" + title + "\",\"language\":\"" + language + "\"}", 201)
                .get("id").asLong();
    }

    private JsonNode detail(long playlist) throws Exception {
        return api.get(me, "/api/playlists/" + playlist, 200);
    }

    static List<Long> itemIds(JsonNode detail) {
        List<Long> ids = new ArrayList<>();
        detail.get("items").forEach(i -> ids.add(i.get("id").asLong()));
        return ids;
    }

    private void add(long playlist, long text) throws Exception {
        api.put(me, "/api/playlists/" + playlist + "/items/" + text, "", 204);
    }

    @Test
    void createsAnEmptyPrivatePlaylist() throws Exception {
        JsonNode p = api.post(me, "/api/playlists",
                "{\"title\":\"  Commute  \",\"description\":\"Short ones\",\"language\":\"fr\"}", 201);
        assertThat(p.get("title").asString()).isEqualTo("Commute");
        assertThat(p.get("description").asString()).isEqualTo("Short ones");
        assertThat(p.get("language").asString()).isEqualTo("fr");
        assertThat(p.get("isPublic").asBoolean()).isFalse();
        assertThat(p.get("mine").asBoolean()).isTrue();
        assertThat(p.get("itemCount").asInt()).isZero();
        assertThat(p.get("completedCount").asInt()).isZero();
        assertThat(detail(p.get("id").asLong()).get("items")).isEmpty();
    }

    @Test
    void rejectsABlankTitleAMissingLanguageAndOverlongFields() throws Exception {
        api.post(me, "/api/playlists", "{\"title\":\"  \",\"language\":\"fr\"}", 400);
        api.post(me, "/api/playlists", "{\"title\":\"A\"}", 400);
        api.post(me, "/api/playlists", "{\"title\":\"" + "x".repeat(121) + "\",\"language\":\"fr\"}", 400);
        api.post(me, "/api/playlists", "{\"title\":\"A\",\"language\":\"fr\",\"description\":\"" + "x".repeat(2001) + "\"}", 400);
        api.post(me, "/api/playlists", "{\"title\":\"" + "x".repeat(120) + "\",\"language\":\"fr\"}", 201);
        api.post(me, "/api/playlists", "{\"title\":\"A\",\"language\":\"fr\",\"description\":\"" + "x".repeat(2000) + "\"}", 201);
        assertThat(api.get(me, "/api/playlists", 200)).hasSize(2);
    }

    @Test
    void itemsKeepTheOrderTheyWereAddedInAndAddingTwiceIsANoOp() throws Exception {
        long p = create(api, me, "P", "fr");
        long a = api.createText(me, "fr", "Un.", false);
        long b = api.createText(me, "fr", "Deux.", false);
        add(p, b);
        add(p, a);
        add(p, b);
        assertThat(itemIds(detail(p))).containsExactly(b, a);
        assertThat(detail(p).get("playlist").get("itemCount").asInt()).isEqualTo(2);
    }

    @Test
    void oneTextCanBeInSeveralPlaylists() throws Exception {
        long first = create(api, me, "First", "fr");
        long second = create(api, me, "Second", "fr");
        long other = create(api, me, "Other", "fr");
        long text = api.createText(me, "fr", "Un.", false);
        add(first, text);
        add(second, text);
        add(other, api.createText(me, "fr", "Deux.", false));
        assertThat(itemIds(detail(first))).containsExactly(text);
        assertThat(itemIds(detail(second))).containsExactly(text);
        JsonNode mine = api.get(me, "/api/playlists?textId=" + text, 200);
        for (JsonNode p : mine) {
            boolean contains = p.get("id").asLong() != other;
            assertThat(p.get("containsText").asBoolean()).as(p.get("title").asString()).isEqualTo(contains);
        }
        assertThat(api.get(me, "/api/playlists", 200).get(0).has("containsText")).isFalse();
    }

    @Test
    void removingAnItemLeavesTheTextAndItsOtherPlaylistsAlone() throws Exception {
        long first = create(api, me, "First", "fr");
        long second = create(api, me, "Second", "fr");
        long text = api.createText(me, "fr", "Un.", false);
        add(first, text);
        add(second, text);
        api.delete(me, "/api/playlists/" + first + "/items/" + text, 204);
        api.delete(me, "/api/playlists/" + first + "/items/" + text, 204);
        assertThat(detail(first).get("items")).isEmpty();
        assertThat(itemIds(detail(second))).containsExactly(text);
        api.get(me, "/api/texts/" + text, 200);
    }

    @Test
    void reordersItemsWithAFullPermutationOnly() throws Exception {
        long p = create(api, me, "P", "fr");
        long a = api.createText(me, "fr", "Un.", false);
        long b = api.createText(me, "fr", "Deux.", false);
        long c = api.createText(me, "fr", "Trois.", false);
        add(p, a);
        add(p, b);
        add(p, c);
        api.put(me, "/api/playlists/" + p + "/items", "{\"textIds\":[" + c + "," + a + "," + b + "]}", 204);
        assertThat(itemIds(detail(p))).containsExactly(c, a, b);
        api.put(me, "/api/playlists/" + p + "/items", "{\"textIds\":[" + a + "," + b + "]}", 400);
        api.put(me, "/api/playlists/" + p + "/items", "{\"textIds\":[" + a + "," + b + "," + c + "," + 999999 + "]}", 400);
        api.put(me, "/api/playlists/" + p + "/items", "{\"textIds\":[" + a + "," + a + "," + b + "]}", 400);
        api.put(me, "/api/playlists/" + p + "/items", "{}", 400);
        assertThat(itemIds(detail(p))).containsExactly(c, a, b);
    }

    @Test
    void onlyTextsInThePlaylistsLanguageCanBeAdded() throws Exception {
        long p = create(api, me, "P", "fr");
        long spanish = api.createText(me, "es", "Uno.", false);
        api.put(me, "/api/playlists/" + p + "/items/" + spanish, "", 400);
        assertThat(detail(p).get("items")).isEmpty();
    }

    @Test
    void addingAMissingTextOrToAMissingPlaylistIsNotFound() throws Exception {
        long p = create(api, me, "P", "fr");
        long text = api.createText(me, "fr", "Un.", false);
        api.put(me, "/api/playlists/" + p + "/items/999999", "", 404);
        api.put(me, "/api/playlists/999999/items/" + text, "", 404);
        api.get(me, "/api/playlists/999999", 404);
    }

    @Test
    void editsTitleDescriptionAndSharingButNotLanguage() throws Exception {
        long p = create(api, me, "Old", "fr");
        JsonNode edited = api.patch(me, "/api/playlists/" + p,
                "{\"title\":\" New \",\"description\":\"About\",\"isPublic\":true,\"language\":\"es\"}", 200);
        assertThat(edited.get("title").asString()).isEqualTo("New");
        assertThat(edited.get("description").asString()).isEqualTo("About");
        assertThat(edited.get("isPublic").asBoolean()).isTrue();
        assertThat(edited.get("language").asString()).isEqualTo("fr");
        JsonNode untouched = api.patch(me, "/api/playlists/" + p, "{}", 200);
        assertThat(untouched.get("title").asString()).isEqualTo("New");
        assertThat(untouched.get("isPublic").asBoolean()).isTrue();
        api.patch(me, "/api/playlists/" + p, "{\"title\":\"  \"}", 400);
        api.patch(me, "/api/playlists/" + p, "{\"description\":\"\"}", 200);
        assertThat(detail(p).get("playlist").has("description")).isFalse();
    }

    @Test
    void myPlaylistsFollowTheLanguageNewestFirst() throws Exception {
        long older = create(api, me, "Older", "fr");
        long newer = create(api, me, "Newer", "fr");
        create(api, me, "Spanish", "es");
        create(api, api.signup(), "Someone else's", "fr");
        JsonNode french = api.get(me, "/api/playlists?language=fr", 200);
        assertThat(french).hasSize(2);
        assertThat(french.get(0).get("id").asLong()).isEqualTo(newer);
        assertThat(french.get(1).get("id").asLong()).isEqualTo(older);
        assertThat(api.get(me, "/api/playlists", 200)).hasSize(3);
    }

    @Test
    void deletingAPlaylistKeepsItsTexts() throws Exception {
        long p = create(api, me, "P", "fr");
        long text = api.createText(me, "fr", "Un.", false);
        add(p, text);
        api.delete(me, "/api/playlists/" + p, 204);
        api.get(me, "/api/playlists/" + p, 404);
        api.get(me, "/api/texts/" + text, 200);
    }

    @Test
    void deletingATextTakesItOutOfEveryPlaylist() throws Exception {
        long p = create(api, me, "P", "fr");
        long gone = api.createText(me, "fr", "Un.", false);
        long kept = api.createText(me, "fr", "Deux.", false);
        add(p, gone);
        add(p, kept);
        api.delete(me, "/api/texts/" + gone, 204);
        assertThat(itemIds(detail(p))).containsExactly(kept);
    }

    @Test
    void countsFinishedItemsAndCarriesReadingProgress() throws Exception {
        long p = create(api, me, "P", "fr");
        long done = api.createText(me, "fr", "Un deux.", false);
        long started = api.createText(me, "fr", "Trois quatre.", false);
        add(p, done);
        add(p, started);
        api.post(me, "/api/texts/" + done + "/complete", "", 200);
        JsonNode d = detail(p);
        assertThat(d.get("playlist").get("completedCount").asInt()).isEqualTo(1);
        assertThat(d.get("items").get(0).get("progress").get("completed").asBoolean()).isTrue();
        assertThat(d.get("items").get(1).has("progress")).isFalse();
        assertThat(d.get("items").get(1).get("stats").get("uniqueWords").asInt()).isEqualTo(2);
        assertThat(api.get(me, "/api/playlists", 200).get(0).get("completedCount").asInt()).isEqualTo(1);
    }

    @Test
    void aPlaylistHoldsAtMost500Items() throws Exception {
        long p = create(api, me, "Big", "fr");
        User owner = users.findById(api.get(me, "/api/me", 200).get("id").asLong()).orElseThrow();
        Playlist playlist = playlists.findById(p).orElseThrow();
        List<PlaylistItem> filler = new ArrayList<>();
        for (int i = 0; i < 499; i++) {
            Text t = new Text(owner, "Filler " + i, Language.FR, "Un.");
            t.setTokensJson("[]");
            filler.add(new PlaylistItem(playlist, texts.save(t), i));
        }
        items.saveAll(filler);
        add(p, api.createText(me, "fr", "Cinq cents.", false));
        api.put(me, "/api/playlists/" + p + "/items/" + api.createText(me, "fr", "De trop.", false), "", 400);
        assertThat(detail(p).get("playlist").get("itemCount").asInt()).isEqualTo(500);
    }

    @Test
    void theFirstThreeItemsAreTheCardsCovers() throws Exception {
        long p = create(api, me, "Deck", "fr");
        assertThat(detail(p).get("playlist").get("covers")).isEmpty();
        long first = api.createText(me, "fr", "Un.", false);
        long video = api.createText(me, "fr", "Deux.", false);
        Text t = texts.findById(video).orElseThrow();
        t.setVideo("abcdefghijk", 60);
        texts.save(t);
        long third = api.createText(me, "fr", "Trois.", false);
        long fourth = api.createText(me, "fr", "Quatre.", false);
        for (long id : new long[] {first, video, third, fourth}) {
            add(p, id);
        }
        JsonNode covers = api.get(me, "/api/playlists", 200).get(0).get("covers");
        assertThat(covers).hasSize(3);
        assertThat(covers.get(0).get("textId").asLong()).isEqualTo(first);
        assertThat(covers.get(0).get("title").asString()).isEqualTo("T");
        assertThat(covers.get(0).get("category").asString()).isEqualTo("other");
        assertThat(covers.get(0).has("thumbnailUrl")).isFalse();
        assertThat(covers.get(1).get("textId").asLong()).isEqualTo(video);
        assertThat(covers.get(1).get("thumbnailUrl").asString())
                .isEqualTo("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
        assertThat(covers.get(2).get("textId").asLong()).isEqualTo(third);
    }

    @Test
    void theFirstVideoItemGivesThePlaylistItsThumbnail() throws Exception {
        long p = create(api, me, "P", "fr");
        long text = api.createText(me, "fr", "Un.", false);
        add(p, text);
        assertThat(detail(p).get("playlist").has("thumbnailUrl")).isFalse();
        long video = api.createText(me, "fr", "Deux.", false);
        Text t = texts.findById(video).orElseThrow();
        t.setVideo("abcdefghijk", 60);
        texts.save(t);
        add(p, video);
        assertThat(detail(p).get("playlist").get("thumbnailUrl").asString())
                .isEqualTo("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    }
}
