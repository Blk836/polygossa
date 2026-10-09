package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.playlist.Playlist;
import app.lector.playlist.PlaylistRepository;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class LearningLanguagesApiTest {

    private static final List<String> PAUSED = List.of("ja", "zh", "ko");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired TextRepository texts;
    @Autowired PlaylistRepository playlists;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private User me() throws Exception {
        return users.findById(api.get(user, "/api/me", 200).get("id").asLong()).orElseThrow();
    }

    private static void notOffered(JsonNode error) {
        assertThat(error.get("code").asString()).isEqualTo("language_not_offered");
        assertThat(error.get("message").asString()).contains("isn't offered for learning");
    }

    private Text storedPublicText(User owner, Language language) {
        Text t = new Text(owner, "Paused " + language.code(), language, "text");
        t.setTokensJson("[]");
        t.setPublic(true);
        return texts.save(t);
    }

    @Test
    void theServerRefusesThemAsALearningLanguage() throws Exception {
        api.patch(user, "/api/me", "{\"targetLanguage\":\"es\"}", 200);
        for (String code : PAUSED) {
            notOffered(api.patch(user, "/api/me", "{\"targetLanguage\":\"" + code + "\"}", 400));
        }
        assertThat(api.get(user, "/api/me", 200).get("targetLanguage").asString()).isEqualTo("es");
    }

    @Test
    void someoneAlreadyLearningOneHasNoLearningLanguageButKeepsIt() throws Exception {
        User u = me();
        u.setTargetLanguage(Language.JA);
        users.save(u);
        assertThat(api.get(user, "/api/me", 200).get("targetLanguage").isNull()).isTrue();
        assertThat(users.findById(u.getId()).orElseThrow().storedTargetLanguage()).isEqualTo(Language.JA);
    }

    @Test
    void newTextsInThemAreRefused() throws Exception {
        for (String code : PAUSED) {
            notOffered(api.post(user, "/api/texts",
                    "{\"title\":\"T\",\"language\":\"" + code + "\",\"content\":\"今日は。\"}", 400));
            notOffered(api.post(user, "/api/texts/import-url",
                    "{\"url\":\"https://example.com/a\",\"language\":\"" + code + "\"}", 400));
        }
        assertThat(api.get(user, "/api/texts", 200)).isEmpty();
    }

    @Test
    void videosBooksAndSubtitlesInThemAreRefused() throws Exception {
        for (String code : PAUSED) {
            notOffered(api.send(multipart("/api/texts/import-youtube")
                    .param("url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ").param("language", code), user, 400));
            notOffered(api.send(multipart("/api/texts/import-book")
                    .file(new MockMultipartFile("file", "b.txt", "text/plain", "今日は。".getBytes()))
                    .param("language", code), user, 400));
            notOffered(api.send(multipart("/api/texts/import-subtitles")
                    .file(new MockMultipartFile("file", "s.srt", "text/plain", "1\n00:00:00,000 --> 00:00:01,000\n今日は\n".getBytes()))
                    .param("title", "S").param("language", code), user, 400));
        }
        assertThat(api.get(user, "/api/texts", 200)).isEmpty();
    }

    @Test
    void wordImportsClassesAndPlaylistsInThemAreRefused() throws Exception {
        for (String code : PAUSED) {
            notOffered(api.send(multipart("/api/word-imports/readlang")
                    .file(new MockMultipartFile("file", "w.csv", "text/csv", "word,translation\n猫,cat\n".getBytes()))
                    .param("language", code), user, 400));
            notOffered(api.post(user, "/api/word-imports/lingq",
                    "{\"apiKey\":\"0123456789abcdef0123456789abcdef01234567\",\"language\":\"" + code + "\"}", 400));
            notOffered(api.post(user, "/api/classes", "{\"name\":\"C\",\"language\":\"" + code + "\"}", 400));
            notOffered(api.post(user, "/api/playlists", "{\"title\":\"P\",\"language\":\"" + code + "\"}", 400));
        }
        assertThat(api.get(user, "/api/word-imports", 200)).isEmpty();
        assertThat(api.get(user, "/api/classes", 200)).isEmpty();
        assertThat(api.get(user, "/api/playlists", 200)).isEmpty();
    }

    @Test
    void askingAListForOneIsABadRequest() throws Exception {
        for (String code : PAUSED) {
            for (String list : List.of("/api/texts", "/api/library", "/api/library/shelves", "/api/library/bookmarks",
                    "/api/playlists", "/api/playlists/shared", "/api/playlists/saved", "/api/recommendations")) {
                notOffered(api.get(user, list + "?language=" + code, 400));
            }
        }
    }

    @Test
    void listsWithoutALanguageNeverShowThem() throws Exception {
        User owner = me();
        List<Long> paused = new ArrayList<>();
        for (Language language : List.of(Language.JA, Language.ZH, Language.KO)) {
            Text text = storedPublicText(owner, language);
            paused.add(text.getId());
            api.put(user, "/api/library/" + text.getId() + "/bookmark", "", 204);
            Playlist playlist = new Playlist(owner, "Paused " + language.code(), language, Instant.now());
            playlist.setPublic(true);
            playlists.save(playlist);
        }
        long spanish = api.createText(user, "es", "Hola.", true);

        assertThat(ids(api.get(user, "/api/texts", 200))).contains(spanish).doesNotContainAnyElementsOf(paused);
        assertThat(ids(api.get(user, "/api/library?size=50&sort=new", 200).get("items")))
                .doesNotContainAnyElementsOf(paused);
        assertThat(ids(api.get(user, "/api/library?size=50&sort=popular", 200).get("items")))
                .doesNotContainAnyElementsOf(paused);
        List<Long> onShelves = new ArrayList<>();
        api.get(user, "/api/library/shelves", 200).forEach(s -> onShelves.addAll(ids(s.get("items"))));
        assertThat(onShelves).doesNotContainAnyElementsOf(paused);
        assertThat(ids(api.get(user, "/api/library/bookmarks", 200))).doesNotContainAnyElementsOf(paused);
        assertThat(languages(api.get(user, "/api/playlists", 200))).doesNotContainAnyElementsOf(PAUSED);
        assertThat(languages(api.get(user, "/api/playlists/shared", 200))).doesNotContainAnyElementsOf(PAUSED);

        assertThat(texts.findAllById(paused)).hasSize(3);
    }

    @Test
    void curatorOptionsListOnlyTheOfferedLanguages() throws Exception {
        assertThat(Language.offered()).extracting(Language::code)
                .containsExactly("en", "es", "fr", "de", "it", "pt");
    }

    private static List<Long> ids(JsonNode list) {
        List<Long> out = new ArrayList<>();
        list.forEach(t -> out.add(t.get("id").asLong()));
        return out;
    }

    private static List<String> languages(JsonNode list) {
        List<String> out = new ArrayList<>();
        list.forEach(t -> out.add(t.get("language").asString()));
        return out;
    }
}
