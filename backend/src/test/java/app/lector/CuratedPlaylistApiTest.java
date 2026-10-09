package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.playlist.Playlist;
import app.lector.playlist.PlaylistBookmarkRepository;
import app.lector.playlist.PlaylistItemRepository;
import app.lector.playlist.PlaylistRepository;
import app.lector.user.LibraryAccount;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: putting curated videos into a community-library playlist (docs/acceptance/copy-playlist.feature), the
 * backend side. Library videos come in through the copy endpoint, so YouTube isn't involved. Each test uses its own
 * videos and playlist title, since other classes on this shared app use the library account too.
 */
@YouTubeApiTest
class CuratedPlaylistApiTest {

    private static final String TOKEN = CuratedVideoImportApiTest.TOKEN;
    private static final String HEADER = CuratedVideoImportApiTest.HEADER;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;

    @Autowired
    PlaylistRepository playlists;

    @Autowired
    PlaylistItemRepository items;

    @Autowired
    PlaylistBookmarkRepository bookmarks;

    @Autowired
    LibraryAccount library;

    @Autowired
    TransactionTemplate tx;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    /**
     * Other classes on this shared app delete the library's videos before each test, which a playlist still holding
     * them would block: leave no library playlist behind.
     */
    @AfterEach
    void removeLibraryPlaylists() {
        library.find().ifPresent(owner -> tx.executeWithoutResult(s -> {
            for (Playlist p : playlists.findAll()) {
                if (p.isOwnedBy(owner)) {
                    items.deleteByPlaylistId(p.getId());
                    bookmarks.deleteByPlaylistId(p.getId());
                    playlists.delete(p);
                }
            }
        }));
    }

    /** Puts a French video into the library (through the copy endpoint) and returns its text id. */
    private long libraryVideo(String id, String title) throws Exception {
        String body = "{\"videoId\":\"" + id + "\",\"language\":\"fr\",\"title\":\"" + title + "\",\"category\":\"learners\","
                + "\"durationSeconds\":30,\"content\":\"Bonjour à tous.\"}";
        JsonNode r = api.send(MockMvcRequestBuilders.post("/api/curator/copies").contentType(MediaType.APPLICATION_JSON)
                .header(HEADER, TOKEN).content(body), null, 201);
        return r.get("id").asLong();
    }

    private JsonNode playlist(String token, String body, int status) throws Exception {
        var request = MockMvcRequestBuilders.post("/api/curator/playlists").contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (token != null) {
            request.header(HEADER, token);
        }
        return api.send(request, null, status);
    }

    private static String body(String title, String description, String language, List<String> videos, boolean dryRun) {
        String ids = String.join(",", videos.stream().map(v -> "\"" + v + "\"").toList());
        return "{\"title\":\"" + title + "\"" + (description == null ? "" : ",\"description\":\"" + description + "\"")
                + (language == null ? "" : ",\"language\":\"" + language + "\"")
                + ",\"videoIds\":[" + ids + "],\"dryRun\":" + dryRun + "}";
    }

    /** The playlist as a learner sees it. */
    private JsonNode detail(long id) throws Exception {
        return api.get(api.signup(), "/api/playlists/" + id, 200);
    }

    private static List<Long> itemIds(JsonNode detail) {
        return detail.get("items").valueStream().map(i -> i.get("id").asLong()).toList();
    }

    // ---- making the playlist ----

    @Test
    void aListBecomesAPublicLibraryPlaylistInListOrder() throws Exception {
        long a = libraryVideo("PLMAKEAAAAA", "A");
        long b = libraryVideo("PLMAKEBBBBB", "B");
        long c = libraryVideo("PLMAKECCCCC", "C");
        JsonNode r = playlist(TOKEN, body("Make series", "Episodes 1 to 3", "fr",
                List.of("PLMAKECCCCC", "PLMAKEAAAAA", "PLMAKEBBBBB"), false), 201);
        assertThat(r.get("outcome").asString()).isEqualTo("created");
        assertThat(r.get("title").asString()).isEqualTo("Make series");
        assertThat(r.get("items").asInt()).isEqualTo(3);
        assertThat(r.get("missing")).isEmpty();

        JsonNode detail = detail(r.get("id").asLong());
        assertThat(detail.get("playlist").get("description").asString()).isEqualTo("Episodes 1 to 3");
        assertThat(detail.get("playlist").get("language").asString()).isEqualTo("fr");
        assertThat(detail.get("playlist").get("isPublic").asBoolean()).isTrue();
        assertThat(detail.get("playlist").get("mine").asBoolean()).isFalse();
        assertThat(itemIds(detail)).containsExactly(c, a, b);
    }

    @Test
    void itShowsInExploreAmongSharedPlaylists() throws Exception {
        libraryVideo("PLEXPLOREAA", "A");
        long id = playlist(TOKEN, body("Explore series", null, "fr", List.of("PLEXPLOREAA"), false), 201)
                .get("id").asLong();
        JsonNode shared = api.get(api.signup(), "/api/playlists/shared?language=fr&q=explore", 200);
        assertThat(shared.valueStream().map(p -> p.get("id").asLong())).contains(id);
    }

    @Test
    void videosTheLibraryLacksAreLeftOutAndListed() throws Exception {
        long a = libraryVideo("PLMISSAAAAA", "A");
        long c = libraryVideo("PLMISSCCCCC", "C");
        JsonNode r = playlist(TOKEN, body("Missing series", null, "fr",
                List.of("PLMISSAAAAA", "PLMISSBBBBB", "PLMISSCCCCC"), false), 201);
        assertThat(r.get("items").asInt()).isEqualTo(2);
        assertThat(r.get("missing").valueStream().map(JsonNode::asString)).containsExactly("PLMISSBBBBB");
        assertThat(itemIds(detail(r.get("id").asLong()))).containsExactly(a, c);
    }

    @Test
    void aVideoTheLibraryHasInAnotherLanguageIsLeftOut() throws Exception {
        libraryVideo("PLLANGAAAAA", "A");
        JsonNode r = playlist(TOKEN, body("Spanish series", null, "es", List.of("PLLANGAAAAA"), false), 422);
        assertThat(r.get("code").asString()).isEqualTo("no_videos");
    }

    // ---- running it again ----

    @Test
    void runningItAgainUpdatesTheSamePlaylistAndKeepsItsSaves() throws Exception {
        long a = libraryVideo("PLAGAINAAAA", "A");
        long id = playlist(TOKEN, body("Again series", "Old", "fr", List.of("PLAGAINAAAA"), false), 201)
                .get("id").asLong();
        String learner = api.signup();
        api.send(MockMvcRequestBuilders.put("/api/playlists/" + id + "/bookmark"), learner, 204);

        long b = libraryVideo("PLAGAINBBBB", "B");
        JsonNode r = playlist(TOKEN, body("Again series", "New", "fr", List.of("PLAGAINBBBB", "PLAGAINAAAA"), false), 200);
        assertThat(r.get("outcome").asString()).isEqualTo("updated");
        assertThat(r.get("id").asLong()).isEqualTo(id);
        JsonNode detail = detail(id);
        assertThat(detail.get("playlist").get("description").asString()).isEqualTo("New");
        assertThat(itemIds(detail)).containsExactly(b, a);
        JsonNode saved = api.get(learner, "/api/playlists/saved?language=fr", 200);
        assertThat(saved.valueStream().map(p -> p.get("id").asLong())).contains(id);
    }

    @Test
    void aDryRunSavesNothing() throws Exception {
        libraryVideo("PLDRYAAAAAA", "A");
        String dry = body("Dry series", null, "fr", List.of("PLDRYAAAAAA", "PLDRYBBBBBB"), true);
        JsonNode r = playlist(TOKEN, dry, 200);
        assertThat(r.get("outcome").asString()).isEqualTo("would_create");
        assertThat(r.get("items").asInt()).isEqualTo(1);
        assertThat(r.get("missing").valueStream().map(JsonNode::asString)).containsExactly("PLDRYBBBBBB");
        assertThat(r.get("id")).isNull();

        playlist(TOKEN, dry.replace("\"dryRun\":true", "\"dryRun\":false"), 201);
        assertThat(playlist(TOKEN, dry, 200).get("outcome").asString()).isEqualTo("would_update");
    }

    // ---- refused ----

    @Test
    void noVideosInTheLibraryMeansNoPlaylist() throws Exception {
        JsonNode r = playlist(TOKEN, body("Empty series", null, "fr", List.of("PLNONEAAAAA"), false), 422);
        assertThat(r.get("code").asString()).isEqualTo("no_videos");
        assertThat(playlist(TOKEN, body("Empty series", null, "fr", List.of("PLNONEAAAAA"), true), 422)
                .get("code").asString()).isEqualTo("no_videos");
    }

    @Test
    void aRequestWithMissingOrInvalidPartsIsRefused() throws Exception {
        libraryVideo("PLBADAAAAAA", "A");
        List<String> videos = List.of("PLBADAAAAAA");
        playlist(TOKEN, body("  ", null, "fr", videos, false), 400);
        playlist(TOKEN, body("T".repeat(121), null, "fr", videos, false), 400);
        playlist(TOKEN, body("Bad series", "D".repeat(2001), "fr", videos, false), 400);
        playlist(TOKEN, body("Bad series", null, "xx", videos, false), 400);
        playlist(TOKEN, body("Bad series", null, null, videos, false), 400);
        // Nothing was made: the first real request creates it.
        assertThat(playlist(TOKEN, body("Bad series", null, "fr", videos, false), 201).get("outcome").asString())
                .isEqualTo("created");
    }

    @Test
    void aWrongTokenOrALearnerIsRefused() throws Exception {
        String body = body("Token series", null, "fr", List.of("PLTOKENAAAA"), false);
        assertThat(playlist("wrong", body, 401).get("code").asString()).isEqualTo("unauthorized");
        playlist(null, body, 401);
        api.send(MockMvcRequestBuilders.post("/api/curator/playlists").contentType(MediaType.APPLICATION_JSON)
                .content(body), api.signupPro(), 401);
    }
}
